# Stress-Test-Replay – Architektur-Entscheidungen

Status: **Freigegeben am 2026-07-06** (alle 5 Empfehlungen; Fenstergrenzen
per Nutzer-Feedback auf Peak-to-Trough konkretisiert und gegen
S&P-500-Schlusskurse verifiziert) · Erstellt: 2026-07-06
Feature: Historische Krisen-Szenarien – der Nutzer sieht, wie sich sein
heutiges (Paper-)Depot in einem historischen Krisenfenster entwickelt hätte
(Verlauf, max. Drawdown, Bezug zu Ampel/Score).

Nach Freigabe werden die Entscheidungen in ARCHITECTURE.md übernommen
(§3 Struktur, §6 API, §10 offene Kalibrierungen) – das Feature ist dort
bisher nicht vorgesehen, dieses Dokument ist der Beschluss dazu.

---

## 1. Asset-Verfügbarkeit im Krisenfenster

**Empfehlung: Positionen ohne Historie ausschließen, Rest renormalisieren,
Ausschluss prominent kennzeichnen – mit Mindestabdeckungs-Schwelle.**

- Ein Asset nimmt am Szenario teil, wenn es **zu Fensterbeginn** bereits
  Kursdaten hat (Toleranz: erste Notierung ≤ 5 Handelstage nach
  Fensterstart). Alles andere wird ausgeschlossen und im Ergebnis
  ausgewiesen: *"NVDA (erst seit 2021 handelbar) ist in diesem Szenario
  nicht enthalten. Simuliert werden 72 % deines Depots."*
- Die verbleibenden Gewichte werden defensiv renormalisiert – das ist
  exakt der bestehende Mechanismus (`normalize_weights`), kein Sonderweg.
- **Mindestabdeckung:** Deckt die simulierbare Teilmenge weniger als 50 %
  des Depotgewichts ab, wird das Szenario für dieses Depot nicht
  gerechnet, sondern mit sprechender Meldung abgelehnt ("Weniger als die
  Hälfte deines Depots existierte 2008 bereits – das Ergebnis wäre nicht
  aussagekräftig."). Schwelle als Konstante (`STRESS_MIN_COVERAGE = 0.5`)
  in `constants.py`, unkalibriert → ARCHITECTURE §10.
- Wichtig fürs Handwerk: Der Ausschluss muss **vor** der Return-Berechnung
  passieren. `daily_returns` truncated per `dropna()` auf die gemeinsame
  Historie – ein spät gelistetes Asset würde sonst das Krisenfenster
  still auf wenige Tage zusammenschneiden statt einen Fehler zu erzeugen.

**Begründung:** Transparenter Ausschluss ist die einzige Option, die
erklärbar bleibt (Prinzip 1) und keine neuen Datenquellen braucht. Die
Kennzeichnung selbst hat Lernwert ("dein halbes Depot gab es 2008 noch
gar nicht" sagt etwas über den Reifegrad der Titel).

**Trade-offs der Alternativen:**
- *Proxy/Branchen-Index:* Realistischer auf dem Papier, aber: die
  Proxy-Wahl ist eine verdeckte fachliche Meinung ("NVDA ≈ Nasdaq") und
  rückt gefährlich nahe an eine Aussage über ein konkretes Wertpapier
  (Prinzip 3). Dazu neue Datenquellen, Mapping-Pflege, Scheingenauigkeit.
  Abgelehnt für v1, auch später nur mit Vorsicht.
- *Feature ganz verweigern:* Verschenkt Lernwert für Depots, die zu 90 %
  simulierbar wären. Nur unterhalb der Mindestabdeckung gerechtfertigt.
- *Ausschluss (gewählt):* Ergebnis beschreibt ein leicht anderes Depot
  als das echte (Survivorship-Verzerrung, Renormalisierung verändert die
  Konzentration). Muss im Ergebnistext explizit stehen; deshalb die
  Abdeckungsquote als Pflichtfeld im Ergebnis-Modell.

---

## 2. Krisenfenster: Presets vs. freie Wahl

**Empfehlung: Drei fest definierte Presets in v1, hart hinterlegt in
`constants.py` – keine freie Zeitraumwahl.**

Fenstergrenzen: jeweils **Markthoch vor dem Einbruch bis Bärenmarkt-Tief**
(Peak-to-Trough), verifiziert gegen S&P-500-Schlusskurse (^GSPC,
2026-07-06): Peak 2007-10-09 (1565,15) / Tief 2009-03-09 (676,53); Peak
2020-02-19 (3386,15) / Tief 2020-03-23 (2237,40); Peak 2022-01-03
(4796,56) / Tief 2022-10-12 (3577,03).

| Preset | Zeitraum (Peak-to-Trough, ^GSPC) | Warum lehrreich |
|---|---|---|
| Finanzkrise 2008/09 | 2007-10-09 – 2009-03-09 | Systemische Krise: tiefe Drawdowns, Korrelationen springen Richtung 1, Diversifikation innerhalb einer Anlageklasse hilft nur begrenzt. Lehre: Klumpen- und Korrelationsrisiko. |
| Corona-Crash 2020 | 2020-02-19 – 2020-03-23 | Schnellster Crash der Geschichte: rund ein Drittel Verlust in fünf Wochen. Lehre: Volatilität aushalten; Panik im Tief ist der teuerste Moment. |
| Zinswende 2022 | 2022-01-03 – 2022-10-12 | Langsamer, zermürbender Bärenmarkt; Tech/Growth überproportional betroffen. Lehre: Sektor-Klumpen – relevant, weil Einsteiger-Depots typischerweise tech-lastig sind. |

- Jedes Preset trägt: `id`, deutschen Titel, Start/Ende, eine statische
  Lernkarte (education-Schicht, gleiche Mechanik wie die Ampel-Lessons).
- **Dotcom-Crash (2000–2002) bewusst nicht in v1:** didaktisch wertvoll,
  aber die meisten Titel typischer Einsteiger-Depots (GOOGL, META, TSLA,
  viele ETFs) existierten damals nicht → das Ausschluss-Feature aus
  Frage 1 würde ständig unter die 50-%-Schwelle fallen und frustrieren.
  Kandidat für später, wenn Proxy-Fragen geklärt sind.

**Begründung:** Presets sind kuratierte Lerninhalte – jedes Fenster hat
eine klare Botschaft und eine statische Erklärkarte (kein LLM im Kernpfad,
Prinzip 2). Feste Fenster machen außerdem das Caching trivial (endliche
Menge, s. Frage 3) und verhindern, dass das Feature als
Backtesting-/Performance-Optimierungs-Werkzeug zweckentfremdet wird – ein
Lern-Tool, das freie Zeiträume anbietet, lädt zum Kurven-Fitting ein und
verschiebt den Fokus von Risiko-Verständnis zu Rendite-Jagd.

**Trade-offs:** Fortgeschrittene verlieren Flexibilität; freie Zeiträume
wären als Phase-2/3-Erweiterung denkbar (dann mit eigener Cache- und
Missbrauchs-Betrachtung). Exakte Fenstergrenzen sind diskutabel (Beginn
Finanzkrise: Lehman-Pleite vs. früher) → als unkalibrierte Entscheidung
in ARCHITECTURE §10 dokumentieren.

---

## 3. Caching historischer Kursdaten

**Empfehlung: Dateibasierter CSV-Cache pro (Preset, Ticker) auf dem
API-Server, davor ein In-Process-Memory-Cache. Kein Redis, keine DB.**

Skizze:

```
backend/.cache/stress/v1/<preset_id>/<TICKER>.csv
```

- Neue Loader-Funktion `load_preset_prices(preset, tickers)`:
  1. fehlende Ticker bestimmen (Cache-Miss),
  2. nur diese gebündelt von yfinance laden (Fallback-Kette wie gehabt),
  3. pro Ticker als CSV ablegen, Ergebnis zusammensetzen.
- CSV statt Parquet: pandas kann es nativ, **keine neue Dependency**
  (pyarrow wäre sonst nötig). Datenmenge pro Ticker/Fenster ist winzig
  (~150 Zeilen), Performance irrelevant.
- **Kein TTL, keine Invalidierung:** Historische Fenster sind unveränderlich
  – der Cache verfällt nie. Das `v1` im Pfad ist die Notbremse, falls sich
  das Speicherformat ändert (Verzeichnis wechseln statt migrieren).
- `.cache/` in `.gitignore`; Verzeichnis liegt neben dem Backend, damit
  es in Phase 1 (Railway/Render) ohne Konfiguration funktioniert.

**Begründung:** Passt zum Phase-1-Prinzip "keine DB, kein Zustand": der
Cache ist reine Ableitung öffentlicher Daten, sein Verlust kostet nur
einen erneuten yfinance-Abruf. Die endliche Preset-Menge (Frage 2) hält
ihn klein: 3 Presets × Depot-Ticker.

**Trade-offs:**
- *Nur In-Memory (`lru_cache`):* noch einfacher, aber nach jedem
  Deploy/Neustart kalt – yfinance wird unnötig oft getroffen (Rate-Limits!).
  Kommt als schnelle erste Ebene **zusätzlich**, nicht statt der Dateien.
- *Dateien im Repo vorhalten:* nur für feste Index-Daten denkbar, nicht
  für beliebige Nutzer-Ticker; vorerst nein.
- *Ephemere Dateisysteme* (Railway/Render): Cache überlebt Redeploys ggf.
  nicht → akzeptiert, es ist nur ein Warm-up-Kostenpunkt, kein Datenverlust.

---

## 4. Rebalancing-Annahme

**Empfehlung: Heutige Gewichte über das gesamte Fenster konstant halten
(implizit: tägliches Rebalancing auf die Zielgewichte) – mit
Transparenzsatz im Ergebnis.**

**Begründung:**
1. **Konsistenz im Produkt:** Score, Volatilität und Ampel rechnen heute
   alle mit konstanten Gewichten (`portfolio_returns = returns @ w`). Das
   Stress-Replay beantwortet dieselbe Frage im selben Modell: *"Wie
   verhält sich diese Allokation unter historischem Stress?"* Zwei
   verschiedene Portfoliomodelle in einer Lern-App wären für Anfänger
   verwirrender als jede einzelne Annahme.
2. **Technisch:** direkte Wiederverwendung von
   `metrics.portfolio_returns` inkl. Ticker-Alignment und
   Shuffle-Test-Absicherung – null neue Portfolio-Mathematik.
3. Bei 2–9-Monats-Fenstern ist die Abweichung zu echtem Buy & Hold
   moderat; sie wächst mit der Fensterlänge (ein weiterer Grund gegen
   Dotcom in v1).

Im Ergebnis steht ein fester Hinweis: *"Annahme: Deine heutigen Gewichte
bleiben im gesamten Zeitraum konstant."*

**Trade-offs:** Echtes Buy & Hold (Gewichte driften mit den Kursen) ist
näher an "ich rühre nichts an" und würde zeigen, wie Konzentration im
Crash von selbst wächst – didaktisch ein eigener, wertvoller Punkt. Dafür
braucht es eigene Pfad-Mathematik (normierte Preispfade statt
Return-Matrix) und erklärt ein anderes Depot als das, das Score/Ampel
bewerten. Als Phase-2-Vergleichsansicht ("konstant vs. laufen lassen")
attraktiv – nicht als v1-Default.

---

## 5. Modul-Schnitt

**Empfehlung: Neues Fachmodul `sentinel_core/stress/` mit `replay.py`;
Presets und Schwellen in `constants.py`; Lernkarten später in
`education/`; API-Endpunkt `POST /stress/replay`.**

```
sentinel_core/stress/
└── replay.py     # ScenarioPreset-Handling, StressReplayResult (frozen),
                  # Orchestrierung: Fenster laden → Abdeckung prüfen →
                  # portfolio_returns → Verlauf + max_drawdown
```

- **Nicht in `risk/`:** Dort lebt reine Metrik-Mathematik (zustandslos,
  eine Formel pro Funktion). Das Replay ist Orchestrierung – es zieht
  Daten (loader), rechnet Metriken (metrics) und produziert ein
  erklärbares Ergebnisobjekt. Gleiche Begründung, aus der `paper/` und
  `education/` eigene Module sind.
- **Wiederverwendung statt Duplikation:** `portfolio_returns`,
  `max_drawdown` aus `risk/metrics.py`; `load_multiple_assets` (mit
  neuem `start`/`end`-Support oder `load_preset_prices`) aus
  `data/loader.py`; `normalize_weights` für die Renormalisierung nach
  Ausschluss. Der Score/Ampel-Bezug ("so hätte deine Ampel im Fenster
  ausgesehen") nutzt die bestehenden Funktionen unverändert.
- Das Altprojekt-Konzept `StressResult` (§13, Instant-Schocks) docken
  später im selben Modul an – §13 hat die Abstraktion genau dafür
  vorgesehen.
- **Ergebnis-Modell (Entwurf):** `StressReplayResult` frozen, mit
  `preset_id`, `value_path` (normierter Depotverlauf), `max_drawdown`,
  `included/excluded_tickers`, `coverage` (Gewichtsanteil), `assumption_note`.

**Trade-offs:** Ein Modul mehr im Baum; Alternative "alles in
`risk/stress.py`" spart das, vermischt aber Metrik- und
Orchestrierungsschicht und macht den späteren Ausbau (Schocks, Presets,
Phase-2-Buy&Hold) unübersichtlicher. Leere Platzhalter entstehen nicht –
das Modul startet mit genau einer Datei, die sofort Fachlogik enthält.

---

## Übergreifende Leitplanken (nicht verhandelbar, aus ARCHITECTURE §1)

1. **Keine Anlageberatung:** Alle Ergebnistexte beschreiben die
   Vergangenheit ("hätte sich entwickelt"), nie Zukunft oder Handlung.
   Fester Disclaimer: *"Historische Szenarien sind keine Prognose."*
   Der bestehende Regressionswächter (Handlungsverb-Check) wird auf die
   neuen Texte ausgeweitet.
2. **Graceful Degradation:** Ohne Internet und leerem Cache liefert das
   Feature eine saubere deutsche Fehlermeldung, der Rest der App bleibt
   unberührt.
3. **Pflicht-Tests** (neue §9-Fälle): Ausschluss + Renormalisierung,
   Mindestabdeckungs-Grenzfall, Fenster-Truncation-Schutz (spätes IPO darf
   das Fenster nicht stauchen), Cache-Hit vermeidet yfinance-Aufruf,
   Shuffle-Test für den Replay-Eintrittspunkt, Textwächter.
