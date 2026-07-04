# KNOWLEDGE_EXTRACTION.md

Extrahiertes Fachwissen aus der Sentinel-Risk-Intelligence-Codebase: fachliche
Regeln, Edge Cases und Design-Entscheidungen, die **nicht** aus einer einfachen
Spec ableitbar wären — also Dinge, die beim ersten Bau gelernt oder mühsam
gelöst wurden. Quellen: Quellcode, Tests, Commit-Historie (Stand: 2026-07-04).

---

## 1. Datenbeschaffung (yfinance) — der fragilste Teil des Systems

`src/sentinel/data/loader.py`

- **yfinance liefert drei verschiedene Spaltenformate**, je nach Aufruf und
  Yahoo-Laune. `load_multiple_assets` muss alle drei behandeln:
  1. Flache Spalten `["Open", "High", ..., "Adj Close", "Volume"]` (ein Ticker)
  2. MultiIndex-Spalten `("Adj Close", "AAPL"), ("Adj Close", "MSFT"), ...`
  3. Manchmal existiert **nur `"Close"`, kein `"Adj Close"`** — Fallback-Kette
     `Adj Close → Close → KeyError` ist Pflicht, kein Nice-to-have.
- `auto_adjust=False` wird **bewusst** gesetzt, damit `Adj Close` überhaupt
  geliefert wird (neuere yfinance-Versionen defaulten auf `auto_adjust=True`,
  wodurch `Adj Close` verschwindet).
- **Ein einzelner Ticker liefert eine `Series`, kein DataFrame** — muss per
  `to_frame(name=tickers[0])` konvertiert werden, sonst bricht der Rest der
  Pipeline.
- **yfinance sortiert Spalten manchmal alphabetisch um**, nicht in der
  angefragten Reihenfolge. Deshalb am Ende explizit `prices[tickers]` —
  das ist kein Kosmetik-Schritt, sondern kritisch (siehe Invariante in §3).
- Fehlende Ticker werden explizit geprüft und mit sprechender Fehlermeldung
  abgewiesen (yfinance liefert bei Tippfehlern sonst still NaN-Spalten).
- `dropna(how="all")` statt `dropna()`: Assets mit unterschiedlichen
  Historienlängen (z.B. späterer IPO) dürfen den gesamten DataFrame nicht
  leeren; nur Zeilen entfernen, in denen **alle** Assets fehlen.
- Leere Antwort (`data.empty`) → sofort `ValueError`, nicht weiterreichen.
- In der UI (Single-Asset-Tab) existiert derselbe `Adj Close`/`Close`-Fallback
  nochmal separat (`streamlit_app.py:54-57`).

## 2. Return-Konventionen

- **Es werden überall einfache Renditen (`pct_change`) verwendet, keine
  Log-Renditen** — der Docstring in `portfolio/portfolio.py` behauptet
  fälschlich "log returns". Die tatsächliche Konvention ist: tägliche simple
  returns, erste Zeile per `dropna()` verworfen.
- `TRADING_DAYS = 252` ist die Annualisierungsbasis, dreifach dupliziert in
  `risk/metrics.py`, `risk/portfolio_risk.py` und `portfolio/optimization.py`.
  Bei Änderung alle drei Stellen anfassen.
- Annualisierung: Volatilität `* sqrt(252)`, Rendite `* 252`.
- Volatilität konsequent mit **`ddof=1`** (Stichproben-Std).

## 3. Kritische, unsichtbare Invariante: Dict-Reihenfolge == Spalten-Reihenfolge

`portfolio_volatility`, `portfolio_risk_contribution` und
`diversification_ratio` bauen den Gewichtsvektor per
`np.array(list(weights.values()))` und multiplizieren ihn gegen
`returns.cov()`. **Es gibt kein Alignment über Ticker-Namen.** Das funktioniert
nur, weil:

1. die Ticker-Liste aus `portfolio.keys()` gezogen wird (Python-Dicts sind
   insertion-ordered),
2. der Loader die Spalten explizit auf `prices[tickers]` reordert.

Wer eine der beiden Seiten ändert (z.B. Spalten sortiert oder das Dict
umbaut), produziert **stillschweigend falsche Risikozahlen** ohne Fehler.
`portfolio_returns` ist dagegen robust, weil `returns @ weights_series` über
den pandas-Index aligned.

## 4. VaR / CVaR — Vorzeichen- und Randfall-Regeln

`src/sentinel/risk/var.py`

- **Vorzeichenkonvention: VaR/CVaR werden als negative Zahlen im
  Return-Raum zurückgegeben** (Verlust = negativ), nicht als positiver
  Verlustbetrag. Die UI formatiert direkt mit `:.2%`. Alle nachgelagerten
  Konsumenten (Scoring) arbeiten mit `abs()`.
- Historischer VaR: `np.percentile(returns, (1 - confidence) * 100)`.
- **CVaR-Randfall:** Wenn der Tail leer ist (`returns <= VaR` trifft nichts,
  möglich bei kleinen Samples/diskreten Verteilungen), wird **der VaR selbst
  zurückgegeben** statt `NaN` aus `mean()` einer leeren Series. Das war eine
  bewusste Absicherung.
- Tail-Definition ist `<=` (inklusive), nicht `<`.
- Parametrischer CVaR (Gauß-ES): `mu - sigma * (pdf(z) / alpha)` mit
  `z = ppf(alpha)` — Formel für den linken Tail in Return-Konvention.
- Getestete Invariante: **CVaR ≤ VaR** (Tail-Mittel ist schlimmer als die
  Schwelle) — siehe `tests/test_cvar_and_scoring.py`.

## 5. Risk Score — alle Kalibrierungskonstanten sind fachliche Entscheidungen

`src/sentinel/risk/scoring.py` — bewusst heuristisch und **erklärbar**
(explizite Design-Entscheidung gegen Black-Box-Scoring):

- Normalisierungsanker (jeweils geclamped auf 0..1):
  | Faktor | Anker ("=1.0") | Bedeutung |
  |---|---|---|
  | Volatilität | 40 % p.a. | "hoch" |
  | Max Drawdown | 50 % | "extrem" |
  | VaR 95 % | 5 % täglich | "hoch" |
  | CVaR 95 % | 8 % täglich | "hoch" |
  | Konzentration (HHI) | `(HHI − 0.10) / 0.20` | 0.10 = diversifiziert, ab ~0.30 voll konzentriert |
- Gewichtung: **Vol 0.30, Drawdown 0.30, VaR 0.20, CVaR 0.15,
  Konzentration 0.05.** Vol und Drawdown dominieren bewusst.
- Konzentration ist optional (`None` bei Single-Asset — dort ist HHI
  sinnlos, wäre immer 1.0).
- Label-Grenzen: ≤25 Low, ≤50 Moderate, ≤75 High, sonst Severe.
- **Erklärbarkeit ist Teil des Kontrakts:** Die Top-3-Treiber werden mit ihrem
  Beitragswert ausgegeben, Null-Beiträge werden herausgefiltert.
- `RiskScore` ist ein `frozen` Dataclass — Ergebnisse sind unveränderlich.

## 6. HHI (Konzentration)

`herfindahl_index` normalisiert die Gewichte **intern selbst** (verlässt sich
nicht auf normierte Inputs) und wirft bei Summe ≤ 0. Wertebereich (0, 1];
1/N bei Gleichgewichtung.

## 7. AI-Risiko-Adjustierung — deterministische, asymmetrische Regel

`src/sentinel/ai/risk_adjustment.py` — explizit "Transparent rules
(NOT black box)":

- Sentiment→Score-Delta-Mapping: `{+2: −6, +1: −3, 0: 0, −1: +4, −2: +8}`.
- **Asymmetrie ist Absicht:** negatives Sentiment erhöht den Score stärker
  (+4/+8) als positives ihn senkt (−3/−6) — konservatives Risikoprinzip.
- Das Delta wird mit der LLM-Confidence skaliert und auf int gerundet:
  geringe Confidence → kaum Einfluss auf den Score.
- Die Rationale (Sentiment, Confidence, Klassifikation) wird immer als Text
  mitgeliefert.

## 8. Hybrid-LLM-Architektur — "funktioniert ohne API-Key" als Grundprinzip

`src/sentinel/ai/llm_client.py`, `market_context.py`, `risk_brief.py`

- **Fallback-Kaskade als zentrales Designmuster:** Kein API-Key →
  `RuntimeError` → Aufrufer fällt auf Manual-Mode zurück. Die App ist ohne
  jeden Key voll benutzbar (wichtig für Demo/Deployment).
- Das `openai`-Paket wird **lazy innerhalb von `generate()`** importiert —
  bewusst, damit es eine optionale Dependency bleibt und der Import der App
  nicht bricht, wenn es fehlt.
- LLM-Antworten werden als **STRICT JSON** angefordert und hart validiert:
  - Sentiment muss in [−2, +2] liegen, Confidence in [0, 1].
  - **Mindestens 3 Bullets**, mehr als 5 werden abgeschnitten.
  - Jeder Parse-Fehler wird zu `ValueError` gebündelt → Aufrufer fällt zurück,
    statt kaputte LLM-Ausgaben durchzureichen.
- `parse_risk_brief` ist dagegen bewusst nachsichtig: bei Parse-Fehler wird
  die rohe LLM-Antwort (erste 500 Zeichen) als "interpretation" angezeigt
  statt zu werfen — der Brief ist rein darstellend, der Market-Context
  dagegen speist den Score und muss valide sein.
- LLM-Aufruf mit `temperature=0.2` (Konsistenz vor Kreativität), System-Rolle
  "risk analyst".

## 9. News-Pipeline (Google News RSS) — viele kleine, erkämpfte Regeln

`src/sentinel/ai/news_loader.py`

- **Google News RSS ist die bewusst gewählte kostenlose, key-lose Quelle**;
  URL-Parameter `hl=en-US&gl=US&ceid=US:en` erzwingen englische US-Ausgabe.
- Ein **eigener User-Agent-Header ist nötig** — ohne ihn drosselt/blockt
  Google Default-Python-Requests gern.
- **Google-News-Titel haben das Format `"Headline - Source"`.** Der Split
  erfolgt per `rsplit(" - ", 1)` — von rechts, weil die Headline selbst
  " - " enthalten kann. Ohne Treffer bleibt "Google News" als Quelle.
- **Throttling 0.4 s zwischen RSS-Requests** ("polite"), sonst Gefahr von
  Rate-Limiting.
- Abfragereihenfolge ist fachlich: erst 3 Makro-Queries ("US stock market
  risk", Fed, Inflation), dann pro Ticker (`limit_per_ticker=4`).
- Deduplizierung über **lowercase-Titel** (gleiche Story von mehreren Queries),
  harte Obergrenze **25 Headlines** (Prompt-Größe kontrollieren).
- `classify_headline_bucket` ist ein absichtlich primitiver
  Substring-Klassifizierer (Ticker-Symbol im großgeschriebenen Titel →
  "company", sonst "macro"). Bekannte Schwäche: kurze Ticker wie "A" oder
  Wörter wie "SPY" erzeugen False Positives — für UI-Filterung akzeptiert.

## 10. CSV-Upload — Validierungsregeln

`src/sentinel/portfolio/upload.py`

- Spaltennamen werden normalisiert (`strip().lower()`) — Uploads mit
  `" Ticker "` / `"WEIGHT"` müssen funktionieren.
- Ticker: `str` → `strip()` → `upper()`. **Leere Ticker sind ein harter
  Fehler**, ebenso negative Gewichte und eine nicht-positive Gewichtssumme.
- Gewichte mit `pd.to_numeric(errors="raise")` — kein stilles NaN-Schlucken.
- **Gewichte müssen nicht auf 1 summieren** — Normalisierung ist ein eigener,
  nachgelagerter Schritt. Nutzer dürfen z.B. Euro-Beträge oder Stückzahlen
  als "weight" hochladen.
- **Doppelte Ticker sind erlaubt und werden per Summe aggregiert**
  (`groupby.sum` in `portfolio_dict_from_dataframe`) — getestetes Verhalten.
- Generelles Prinzip im ganzen System: **Gewichte werden an jedem
  Eintrittspunkt defensiv renormalisiert** (`portfolio_returns`, UI,
  Upload) — nie darauf vertrauen, dass sie schon normiert sind.

## 11. Portfolio-Optimierung — Nebenbedingungen mit fachlicher Bedeutung

`src/sentinel/portfolio/optimization.py`

- Solver: SLSQP mit Gleichheits-Constraint `sum(w) = 1` und
  Startpunkt Gleichgewichtung.
- **Long-only** (untere Schranke 0) und **`max_weight = 0.6` pro Asset** —
  die Kappung ist eine bewusste Diversifikationsregel; ohne sie schiebt
  Max-Sharpe oft alles in ein einziges Asset.
- **Division-durch-Null-Guard im Sharpe-Objective:** bei Portfolio-Vol 0 wird
  die Penalty `1e6` zurückgegeben statt zu crashen (SLSQP probiert auch
  degenerierte Gewichte).
- `result.success` wird geprüft; Fehlschlag → `ValueError` mit
  Solver-Message, kein stilles Weiterrechnen.
- Annualisierung (×252) findet im Objective statt — ändert das Argmin nicht,
  hält aber Sharpe-Werte interpretierbar.

## 12. Risk Contribution & Diversification Ratio

- Risk Contribution ist **varianzbasiert**: `w_i · (Σw)_i / (wᵀΣw)` —
  die Beiträge summieren sich zu 1 (relative Anteile). Tägliche Kovarianz
  reicht, da Annualisierung sich herauskürzt.
- Der UI-Vergleich "Weight vs. Risk Contribution" ist das eigentliche
  fachliche Produkt: zeigt, dass Kapitalgewicht ≠ Risikogewicht.
- Diversification Ratio = gewichtete Einzelvols / Portfoliovol, ebenfalls auf
  Tagesbasis (Ratio ist skalierungsinvariant). Werte > 1 = Diversifikation
  wirkt.

## 13. Stress-Testing — bewusst minimal

`apply_market_shock` / `apply_single_asset_crash` schocken **nur den letzten
Preis instantan**; `shocked_return == shock_pct` per Konstruktion. Keine
Korrelationseffekte, keine Pfadabhängigkeit. Die `StressResult`-Abstraktion
existiert trotzdem, damit später echte Szenarien (Multi-Asset,
korrelierte Schocks) andocken können, ohne die UI zu ändern.

## 14. Streamlit-spezifische Erkenntnisse (mühsamste Lektionen)

Aus `streamlit_app.py` und Commit `86a4e24` ("fix(ui): resolve portfolio
state and optimization scope issues"):

- **Buttons sind nur im Klick-Rerun `True`.** Ergebnisse, die ein anderer
  Button/Tab später braucht, **müssen in `st.session_state`** landen. Deshalb
  werden `portfolio`, `returns_df` und `rc` nach der Portfolio-Analyse
  explizit in Session State geschrieben; Optimierung und Executive Brief
  lesen ausschließlich von dort und zeigen sonst "Run portfolio analysis
  first" an.
- **Jedes Widget hat einen expliziten `key=`** — ohne eindeutige Keys wirft
  Streamlit bei gleichartigen Widgets über Tabs hinweg
  DuplicateWidgetID-Fehler.
- **News-Caching:** `@st.cache_data(ttl=900)` (15 min). Die Ticker werden als
  **Tuple** übergeben, weil `cache_data` hashbare Argumente braucht (Listen
  sind nicht hashbar). "Force Refresh" umgeht den Cache, indem es die
  ungecachte Funktion direkt aufruft — einfacher und zuverlässiger als
  Cache-Invalidierung.
- Portfolio-JSON-Validierung: muss ein Dict mit **mindestens 2 Tickern** sein
  (Portfolio-Metriken für 1 Asset sind sinnlos); danach `st.stop()` statt
  weiterlaufen.
- Der CSV-Upload befüllt nur den **Default-Wert der JSON-Textarea** — die
  Textarea bleibt die einzige Quelle der Wahrheit für die Analyse. Die
  Konvertierung `str(dict).replace("'", '"')` ist ein pragmatischer Hack, um
  aus einem Python-Dict gültiges JSON für das Textfeld zu machen.
- Fetch-Fehler bei News sind **Warnungen, keine Fehler** — manueller
  Headline-Input bleibt immer als Fallback nutzbar (gleiche Philosophie wie
  beim LLM: das System degradiert, es bricht nicht).
- ⚠️ **Bekannte Falle im Single-Asset-Tab:** Der Stress-Slider liegt
  *innerhalb* des `if run_single:`-Blocks. Slider-Änderung löst einen Rerun
  aus, bei dem der Button wieder `False` ist → alle Ergebnisse verschwinden.
  (Latenter UX-Bug, gleiche Klasse wie das per Commit gefixte
  Optimierungsproblem.)
- ⚠️ **Latenter Bug im Manual-Fallback des Market Briefs**
  (`streamlit_app.py:446-462`): Der hartkodierte Fallback-JSON-String enthält
  versehentlich Python-Klammern/Tuple-Syntax mitten im JSON — `json.loads`
  schlägt fehl, `parse_market_context` wirft, und dieser Pfad ist **nicht**
  in try/except gewickelt. Der Manual-Modus des "Generate Market Brief" ist
  dadurch aktuell defekt.

## 15. Packaging-, CI- und Deployment-Lektionen

- **Streamlit Cloud:** Lokales Paket wird nur gefunden, wenn `-e .` als
  **erste Zeile in `requirements.txt`** steht (Commit `748fa94`,
  "fix: install local package for streamlit cloud deployment") — Streamlit
  Cloud installiert nur requirements.txt, kein `pip install .`.
- Das Projekt wurde nachträglich zum Paket (`pyproject.toml`,
  `package-dir = {"" = "src"}`), um Import-Probleme zu lösen (Commit
  `3b2e9bb`); CI setzt zusätzlich `PYTHONPATH: src` für pytest.
- `dependencies = []` in pyproject ist Absicht — Dependencies leben nur in
  requirements.txt; das Paket dient rein der Importierbarkeit.
- **Python-3.11-Kompatibilität ist die Untergrenze** (`requires-python =
  ">=3.11"`, CI auf 3.11); Commit `c4efd7f` formatierte Code dafür um. Moderne
  Typannotationen (`X | None`, `dict[str, float]`) sind ok, 3.12+-Features
  nicht.
- Doppelte Format-Polizei: **ruff** (E, F, I, B, UP) *und* **black** laufen in
  CI — Code muss beiden genügen (mehrere "chore: fix linting"-Commits zeugen
  vom Abstimmungsaufwand, u.a. `zip(strict=...)` wegen Ruff-Regel B905).
- `.env` wird per `load_dotenv()` beim Import von `llm_client` geladen;
  `OPENAI_API_KEY` ist die einzige Konfigurationsvariable.

## 16. Leere Platzhalter (bewusst angelegt, nie gefüllt)

`data/validation.py`, `config/settings.py`, `utils/helpers.py` sind faktisch
leer — geplante Struktur, die nie gebraucht wurde. Bei einem Neubau nicht als
"fehlende Features" fehlinterpretieren.

---

## Kompakteste Zusammenfassung der Top-Erkenntnisse

1. yfinance-Spaltenformate sind instabil → dreifacher Fallback + explizites
   Column-Reordering ist Pflicht.
2. Gewichts-Dict-Reihenfolge muss der Spaltenreihenfolge der Returns
   entsprechen — unsichtbare, aber kritische Invariante.
3. VaR/CVaR sind negative Return-Werte; CVaR fällt bei leerem Tail auf VaR
   zurück; Invariante CVaR ≤ VaR.
4. Der Risk Score ist eine bewusst erklärbare Heuristik mit festen
   Kalibrierungsankern (40 % Vol, 50 % DD, 5 % VaR, 8 % ES) und Gewichten
   (0.30/0.30/0.20/0.15/0.05).
5. Die AI-Adjustierung ist deterministisch und asymmetrisch (schlechte News
   wiegen schwerer) und wird mit Confidence skaliert.
6. Alles AI-/News-seitige folgt dem Prinzip "graceful degradation": ohne
   API-Key, ohne Internet, ohne parsebare LLM-Antwort bleibt die App nutzbar.
7. Streamlit: Ergebnisse für Cross-Button/Cross-Tab-Nutzung immer in
   `st.session_state`; jedes Widget mit `key=`; Cache-Argumente hashbar.
8. Streamlit Cloud braucht `-e .` in requirements.txt für lokale Pakete.
