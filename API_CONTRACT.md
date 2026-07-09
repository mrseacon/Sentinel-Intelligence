# API-Vertrag sentinel_api (v1)

Status: **Entwurf, wartet auf Feedback** · Datum: 2026-07-09
Grundlage: ARCHITECTURE.md §6 + alle Ergebnismodelle in `sentinel_core/`.
Noch keine Implementierung – dieses Dokument IST der Vertrag, den
`sentinel_api/schemas/` und `frontend/lib/types.ts` anschließend spiegeln.

---

## 1. Querschnitts-Konventionen (gelten für ALLE Endpunkte)

### 1.1 Fehlerformat

Jede Fehlerantwort hat exakt dieses Schema:

```python
class ErrorResponse(BaseModel):
    detail: str   # deutsche, sprechende Meldung – direkt anzeigbar
    code: str     # stabiler, maschinenlesbarer Code (SCREAMING_SNAKE)
```

**HTTP-Status-Zuordnung:**

| Status | Wann | code |
|---|---|---|
| 422 | Request-Schema verletzt (pydantic) | `VALIDATION_ERROR` |
| 422 | Fachlicher `ValueError` aus sentinel_core | spezifischer Code, s.u. |
| 503 | Kursdatenquelle nicht erreichbar (Netzwerk/yfinance) | `UPSTREAM_UNAVAILABLE` |
| 500 | Unerwarteter Fehler | `INTERNAL_ERROR` (detail generisch, keine Interna) |

**Mapping-Konvention für interne `ValueError`s:** sentinel_core wirft
durchgängig deutsche `ValueError`s – die `detail`-Texte werden
**unverändert durchgereicht** (sie sind bereits nutzertauglich, das war
die Absicht). Der `code` kommt aus einer zentralen Präfix-Registry in
der API-Schicht:

| Message-Präfix (core) | code |
|---|---|
| "Keine Kursdaten" / "Keine Renditedaten" | `TICKER_NOT_FOUND` |
| "Keine Ticker angegeben" / "Keine Gewichte" / "Negative Gewichte" / "Summe der Gewichte" | `PORTFOLIO_INVALID` |
| "Kauf von" | `PAPER_INSUFFICIENT_CASH` |
| "Verkauf von" | `PAPER_INSUFFICIENT_HOLDINGS` |
| "Verkaufserlös deckt" | `PAPER_FEE_NOT_COVERED` |
| "Inkonsistente Transaktionshistorie" | `LEDGER_INCONSISTENT` |
| "Menge muss" | `PAPER_INVALID_QUANTITY` |
| "Unbekanntes Krisen-Szenario" | `STRESS_UNKNOWN_PRESET` |
| "…nicht aussagekräftig" (Abdeckung) | `STRESS_INSUFFICIENT_COVERAGE` |
| "Zeithorizont muss" | `SIM_HORIZON_INVALID` |
| "Zu wenig Kurshistorie" | `SIM_INSUFFICIENT_HISTORY` |
| "…nicht konvergiert" | `OPTIMIZER_NO_CONVERGENCE` |
| "…enthalten Lücken" / "degeneriert" / "mindestens 2 Assets" / "Zu wenige Datenpunkte" | `OPTIMIZER_INVALID_INPUT` |
| alles andere | `DOMAIN_ERROR` (Fallback) |

Präfix-Matching ist eine bewusste v1-Brücke. **Ziellösung (kleiner
Refactor, sobald es zwickt):** eine `SentinelError(ValueError)`-Basisklasse
in core mit `code`-Attribut; die bestehenden Message-Tests bleiben dabei
gültig. Bis dahin gilt: Wer eine core-Fehlermeldung umformuliert, prüft
die Registry.

pydantic-`ValidationError`s (englisch) werden NICHT durchgereicht:
die API-Schicht übersetzt sie zu einem deutschen `detail`
("Ungültige Eingabe im Feld 'quantity': ganze Zahl größer 0 erwartet.")
mit code `VALIDATION_ERROR`.

### 1.2 Zahlen-Konventionen

- **Anteile/Renditen/Risikokennzahlen: Dezimalbrüche.** 0.42 bedeutet
  42 %. Kein Feld liefert vorformatierte Prozente. Felder mit Suffix
  `_pct` sind ebenfalls Dezimalbrüche (dokumentierte Altlast aus
  `total_pnl_pct`; kein Rename, um core und API deckungsgleich zu halten).
- **VaR/CVaR/max_drawdown: negativ** (Verlust = negativ, Return-Raum) –
  die core-Konvention wird durchgereicht, das Frontend nutzt `abs()`
  fürs Anzeigen.
- **Wertverläufe: normierte Faktoren**, Start = 1.0 (Stress `value_path`,
  Simulation `p10/p50/p90`). Multiplikation mit dem echten Depotwert ist
  Frontend-Sache.
- **Geldbeträge: float in Euro** (Preise, Cash, Gebühren, Marktwerte).
  Keine Cent-Integer – Lern-App, keine Buchhaltung; Rundung im Frontend.
- **Stückzahlen: int** (ganze Aktien, v1 ohne Fractional Shares).

### 1.3 Zeit-Konventionen

- Zeitstempel: ISO 8601. Zeitzonen-behaftete Felder (`executed_at`)
  immer UTC ("Z"). `asof`/`price_asof` von Tageskursen tragen
  Mitternachts-Zeitstempel ohne Zeitzone – dokumentierte
  yfinance-Eigenheit, Anzeige "Kurs von TT.MM." statt "HH:MM" wenn
  keine Uhrzeit-Information vorhanden.
- Tagesgranulare Verläufe: reine Daten (`YYYY-MM-DD`).
- Zukunfts-Zeitachsen (Simulation): Handelstag-Offsets als int, KEINE
  Kalenderdaten (Scheinpräzision).
- Zeitreihen als **parallele Arrays** (`dates` + `values`), nicht als
  Objektlisten – kleine Payloads, direkt Recharts-kompatibel.

### 1.4 Sprach-Konvention

Maschinenlesbares englisch (`id`, `status`-Enums wie `green|yellow|red`,
`label` wie `Low|Moderate`, `side` `BUY|SELL`, Feldnamen), nutzerlesbare
Inhalte deutsch (`title`, `explanation`, `lesson`, `disclaimer`,
`detail`). Texte kommen fertig formatiert vom Backend (deutsche
Zahlenformate in Sätzen); rohe Zahlenfelder sind unformatiert.

### 1.5 Einheitliche Eingabe-Bausteine

```python
class PortfolioIn(BaseModel):
    """DER einzige Weg, ein Portfolio zu übergeben – überall identisch."""
    weights: dict[str, float]   # Ticker → positives Gewicht, BELIEBIGE
                                # Skala (€-Beträge/Stück/Anteile);
                                # Renormalisierung passiert serverseitig

Period = Literal["6mo", "1y", "2y", "5y"]   # Whitelist statt freiem String

Side = Literal["BUY", "SELL"]

class PaperAccountIn(BaseModel):            # 1:1 core ledger.PaperAccount
    id: str
    name: str = "Paper-Depot"
    start_cash: float = 10_000.0
    created_at: datetime

class TransactionIO(BaseModel):             # 1:1 core ledger.Transaction;
    id: str                                 # identisches Schema für
    account_id: str | None                  # Request UND Response –
    ticker: str                             # der Client speichert exakt
    side: Side                              # das, was er zurückbekommt
    quantity: int                           # (localStorage, §4.1/§7)
    price: float
    price_asof: datetime | None
    fees: float
    executed_at: datetime                   # tz-aware Pflicht (AwareDatetime)
```

Ausnahme GET-Endpunkte: `tickers` als komma-separierter Query-Parameter
(`?tickers=AAPL,MSFT`), serverseitig gesplittet – REST-üblich, einzige
Abweichung vom `PortfolioIn`-Muster (GET hat keinen Body).

---

## 2. Endpunkte

Tempo-Legende: ⚡ schnell (reine Rechnung/Konstanten) · 🐢 langsam
(yfinance-Roundtrip; Frontend braucht Loading-State).

### 2.1 `GET /health` ⚡

Response 200: `{"status": "ok"}` (existiert bereits, unverändert).

### 2.2 `GET /prices/{ticker}` 🐢

Letzter (verzögerter) Kurs. Wrapper um `loader.LatestPrice` (+ Ticker):

```python
class PriceOut(BaseModel):
    ticker: str
    price: float
    asof: datetime
```

Fehler: 422 `TICKER_NOT_FOUND`, 503 `UPSTREAM_UNAVAILABLE`.

### 2.3 `GET /prices/history?tickers=&period=` 🐢

```python
class PriceHistoryOut(BaseModel):
    period: Period
    dates: list[date]                       # gemeinsame Zeitachse
    prices: dict[str, list[float | None]]   # Ticker → Kursreihe;
                                            # None = Tag ohne Kurs
                                            # (kürzere Historie)
```

`None` statt Zeilen-Dropping: `dropna(how="all")`-Verhalten des Loaders
bleibt sichtbar, das Frontend entscheidet über Lücken-Darstellung.
Fehler: 422 `TICKER_NOT_FOUND` / `VALIDATION_ERROR` (unbekannte period),
503 `UPSTREAM_UNAVAILABLE`.

### 2.4 `POST /risk/analyze` 🐢

```python
class RiskAnalyzeIn(BaseModel):
    portfolio: PortfolioIn
    period: Period = "1y"

class RiskMetricsOut(BaseModel):
    volatility: float                # annualisiert, Dezimalbruch
    max_drawdown: float              # negativ
    var_95: float                    # negativ, täglich
    cvar_95: float                   # negativ, täglich
    hhi: float | None                # None bei Single-Asset (§5-Konvention)
    diversification_ratio: float

class ScoreDriverOut(BaseModel):
    factor: str                      # API-Umbenennung von core "name" (s. §3)
    contribution: float

class RiskScoreOut(BaseModel):
    score: float                     # 0..100
    label: str                       # Low|Moderate|High|Severe
    components: dict[str, float]     # Faktor → normierter Wert 0..1
    drivers: list[ScoreDriverOut]    # Top 3

class RiskAnalyzeOut(BaseModel):
    metrics: RiskMetricsOut
    score: RiskScoreOut
    risk_contribution: dict[str, float]   # Ticker → Anteil, Summe 1
```

Fehler: 422 `PORTFOLIO_INVALID` / `TICKER_NOT_FOUND`, 503.
Phase-2-Reserve: optionales Feld `ai: AiAssessmentOut | None` (heute
nicht Teil des Vertrags; `rationale` wird dann zu `explanation`
gemappt, s. §3).

### 2.5 `POST /risk/ampel` 🐢

```python
class RiskAmpelIn(BaseModel):
    portfolio: PortfolioIn
    period: Period = "1y"

class AmpelOut(BaseModel):
    id: str                          # concentration|diversification|volatility
                                     # (API-Umbenennung von core "name", s. §3)
    title: str                       # deutsch: "Klumpenrisiko" …
    status: Literal["green", "yellow", "red"]
    value: float
    explanation: str
    lesson: str

class RiskAmpelOut(BaseModel):
    ampeln: list[AmpelOut]           # immer genau 3, feste Reihenfolge
```

Fehler wie 2.4.

### 2.6 `POST /portfolio/optimize` 🐢

```python
class OptimizeIn(BaseModel):
    tickers: list[str]               # BEWUSST keine Gewichte: der Optimizer
    period: Period = "1y"            # bestimmt sie neu; Eingabegewichte
                                     # würden Bedeutung suggerieren

class OptimizeOut(BaseModel):        # core OptimizationResult + disclaimer
    weights: dict[str, float]
    expected_return: float           # annualisiert, Dezimalbruch
    volatility: float
    sharpe: float
    disclaimer: str                  # NEU, Pflicht (Prinzip 3!): "Rechnerische
                                     # Max-Sharpe-Gewichtung der eingegebenen
                                     # Titel auf Basis vergangener Kurse –
                                     # keine Empfehlung, Vergangenheit ≠ Zukunft."
```

Der Optimizer ist der Prinzip-3-heikelste Endpunkt: Das Ergebnis ist
eine **Eigenschaft der eingegebenen Tickermenge**, keine Kauf-Liste.
Der Pflicht-Disclaimer im Response-Objekt (statt nur in der UI) stellt
sicher, dass kein API-Konsument ihn "vergessen" kann.
Fehler: 422 `OPTIMIZER_INVALID_INPUT` / `OPTIMIZER_NO_CONVERGENCE` /
`TICKER_NOT_FOUND`, 503.

### 2.7 `POST /paper/quote` 🐢

```python
class PaperQuoteIn(BaseModel):
    ticker: str
    side: Side
    quantity: int                    # > 0

class QuoteOut(BaseModel):           # 1:1 core engine.Quote
    ticker: str
    side: Side
    quantity: int
    price: float
    price_asof: datetime
    fees: float
    gross_value: float
    cash_delta: float                # negativ bei BUY
```

"Cash danach" (§6) = `cash_aktuell + cash_delta`, rechnet der Client –
die Quote selbst bleibt zustandslos (kein Account im Request nötig).
Fehler: 422 `PAPER_INVALID_QUANTITY` / `TICKER_NOT_FOUND`, 503.

### 2.8 `POST /paper/execute` 🐢

```python
class PaperExecuteIn(BaseModel):
    account: PaperAccountIn
    transactions: list[TransactionIO]   # Phase 1 zustandslos: die komplette
    ticker: str                         # Historie kommt vom Client (§6)
    side: Side
    quantity: int
```

Response 200: **`TransactionIO`** – nur die NEUE Transaktion; der Client
hängt sie selbst an seine Liste an (Event-Sourcing bleibt clientseitig).
Fehler: 422 `PAPER_INSUFFICIENT_CASH` / `PAPER_INSUFFICIENT_HOLDINGS` /
`PAPER_FEE_NOT_COVERED` / `PAPER_INVALID_QUANTITY` /
`LEDGER_INCONSISTENT` / `TICKER_NOT_FOUND`, 503.

### 2.9 `POST /paper/valuation` 🐢 (⚡ bei leerem Depot)

```python
class PaperValuationIn(BaseModel):
    account: PaperAccountIn
    transactions: list[TransactionIO]

class PositionValueOut(BaseModel):   # 1:1 core valuation.PositionValue
    ticker: str
    quantity: int
    avg_buy_price: float
    current_price: float
    price_asof: datetime
    market_value: float
    unrealized_pnl: float

class AccountValuationOut(BaseModel) # 1:1 core valuation.AccountValuation
    cash: float
    market_value: float
    total_value: float
    total_pnl: float
    total_pnl_pct: float             # Dezimalbruch (s. §1.2)
    positions: list[PositionValueOut]
```

Fehler: 422 `LEDGER_INCONSISTENT` / `TICKER_NOT_FOUND`, 503.

### 2.10 `POST /stress/replay` 🐢 (Cache-⚡ ab dem zweiten Aufruf)

```python
class StressReplayIn(BaseModel):
    portfolio: PortfolioIn
    preset_id: str                   # gfc_2008|covid_2020|rates_2022

class StressReplayOut(BaseModel):    # 1:1 core StressReplayResult
    preset_id: str
    title: str
    start: date
    end: date
    dates: list[date]
    value_path: list[float]          # Faktor, Start 1.0
    max_drawdown: float              # negativ
    total_return: float
    volatility: float
    coverage: float                  # Dezimalbruch
    included_tickers: list[str]
    excluded_tickers: list[str]
    explanation: str
    lesson: str
    disclaimer: str
```

Fehler: 422 `STRESS_UNKNOWN_PRESET` / `STRESS_INSUFFICIENT_COVERAGE` /
`PORTFOLIO_INVALID`, 503.

### 2.11 `POST /simulation/monte-carlo` 🐢 (+~1 s Rechnung)

```python
class MonteCarloIn(BaseModel):
    portfolio: PortfolioIn
    horizon_years: Literal[1, 5, 10]

class MonteCarloOut(BaseModel):      # 1:1 core MonteCarloResult
    horizon_years: int
    n_paths: int
    seed: int
    trading_days: list[int]          # Offsets, Start 0
    p10: list[float]                 # Faktoren, Start 1.0
    p50: list[float]
    p90: list[float]
    final_p10: float
    final_p50: float
    final_p90: float
    history_days: int
    history_years: float
    limiting_ticker: str | None
    recycling_factor: float
    thin_history: bool
    explanation: str
    lesson: str
    disclaimer: str
```

Fehler: 422 `SIM_HORIZON_INVALID` / `SIM_INSUFFICIENT_HISTORY` /
`PORTFOLIO_INVALID` / `TICKER_NOT_FOUND`, 503.

### 2.12 `GET /stress/presets` ⚡

```python
class ScenarioPresetOut(BaseModel):  # 1:1 core stress.ScenarioPreset
    id: str
    title: str
    start: date
    end: date

class StressPresetsOut(BaseModel):
    presets: list[ScenarioPresetOut]
```

Keine Fehlerfälle außer 500.

---

## 3. Gefundene Inkonsistenzen & die eine Konvention

Beim Quervergleich der 13 core-Ergebnismodelle gefunden und hier
vereinheitlicht:

1. **`explanation` vs. `rationale`:** Ampel/Stress/Simulation nennen den
   depot-spezifischen Text `explanation`; nur `AiAssessment` (API-los)
   nennt ihn `rationale`. **Konvention: `explanation` überall.** Wenn
   das AI-Feld in Phase 2 in `/risk/analyze` einzieht, wird `rationale`
   im API-Schema zu `explanation` gemappt.
2. **`name` vs. `id`:** `Ampel.name` und `ScenarioPreset.id` bezeichnen
   dasselbe Konzept (maschinenlesbarer Bezeichner einer wählbaren
   Entität). **Konvention: im API heißt es `id`** – `AmpelOut` mappt
   `name → id` (Serialization-Alias, core bleibt unangetastet).
   `ScoreDriver.name` ist kein Entitäts-Bezeichner, sondern ein
   Faktorname → wird im API zu `factor` (präziser, kollidiert nicht
   mit der id-Regel).
3. **Faktor vs. Dezimalbruch vs. "pct":** Wertverläufe (Stress,
   Simulation) sind Faktoren ab 1.0; Renditen/Anteile Dezimalbrüche;
   `total_pnl_pct` ist trotz Suffix ein Dezimalbruch. **Konvention wie
   §1.2** – dokumentiert statt umbenannt, damit core-Modelle 1:1
   durchgereicht werden können.
4. **Texte-Vollständigkeit:** Ampel hat `explanation + lesson` (kein
   disclaimer – der Ampel-Disclaimer ist laut ARCHITECTURE §1 fest in
   der UI), Stress/Simulation haben alle drei. Bewusst so belassen;
   `OptimizeOut` bekommt als einziges API-Schema einen **zusätzlichen**
   Pflicht-Disclaimer (§2.6), weil dort das Prinzip-3-Risiko am größten
   ist und core dafür kein Textfeld hat.
5. **Zeitstempel-Mischung:** `executed_at` aware/UTC (erzwungen),
   `asof/price_asof` je nach yfinance-Datenlage naive Tagesstempel.
   Konvention §1.3: dokumentiert statt künstlich vereinheitlicht –
   eine erfundene Uhrzeit wäre Scheinpräzision.
6. **Portfolio-Übergabe:** ohne Vertrag wäre das Portfolio dreimal
   unterschiedlich strukturiert worden (weights-Dict in risk/stress/sim,
   Ticker-Liste im Optimizer, implizit über Transaktionen im Paper-Teil).
   **Konvention: `PortfolioIn` überall dort, wo Gewichte fachlich
   relevant sind; der Optimizer nimmt bewusst NUR `tickers`** (Gewichte
   würden Bedeutung suggerieren, die er ignoriert); Paper leitet
   Gewichte gar nicht – dort ist die Transaktionsliste die Quelle der
   Wahrheit.
7. **Zeitreihen-Stil:** Stress (`dates` + `value_path`) und Simulation
   (`trading_days` + `p10/p50/p90`) nutzen bereits parallele Arrays;
   `PriceHistoryOut` übernimmt den Stil (§1.3) statt Objektlisten.

---

## 4. 1:1 durchreichbar vs. Wrapper nötig

**1:1 als API-Response (core-Modell == Vertrag, nur Re-Export):**
- `engine.Quote` → `QuoteOut`
- `ledger.Transaction` → `TransactionIO` (Request UND Response)
- `ledger.PaperAccount` → `PaperAccountIn`
- `valuation.PositionValue` / `AccountValuation` → 2.9
- `stress.StressReplayResult` → `StressReplayOut`
- `stress.ScenarioPreset` → `ScenarioPresetOut`
- `simulation.MonteCarloResult` → `MonteCarloOut`

**Alias-/Wrapper-Schema nötig:**
- `loader.LatestPrice` → `PriceOut` (Ticker ergänzen)
- Loader-DataFrame → `PriceHistoryOut` (DataFrame→JSON, kein core-Modell
  vorhanden – bewusst: pandas bleibt API-frei)
- `education.Ampel` → `AmpelOut` (`name` → `id`)
- `scoring.ScoreDriver` → `ScoreDriverOut` (`name` → `factor`)
- `scoring.RiskScore` → `RiskScoreOut` (nur wegen ScoreDriver-Alias)
- Metrik-Einzelwerte → `RiskMetricsOut` (Aggregation mehrerer
  metrics-Funktionen, kein core-Sammelmodell vorhanden – bewusst, core
  bietet Funktionen, die API komponiert)
- `portfolio.OptimizationResult` → `OptimizeOut` (+ Pflicht-Disclaimer)
