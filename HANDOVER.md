# HANDOVER – Stand nach den Fachlogik-Sessions (aktualisiert 2026-07-09)

Orientierungshilfe für die nächste Session. **Primäre Referenz bleiben
CLAUDE.md (Arbeitsregeln) und ARCHITECTURE.md (Entscheidungen) – zuerst
lesen, dann hierher zurückkommen.** Dieses Dokument ist die Landkarte,
nicht die Spezifikation.

## 1. Status: Fachlogik-Schicht komplett

`sentinel_core/` ist fertig und getestet (**146 Tests, CI grün**,
ruff + black sauber):

| Modul | Zweck |
|---|---|
| `constants.py` | EINZIGE Quelle aller fachlichen Konstanten (Anker, Schwellen, Gebühren, Presets) |
| `data/loader.py` | yfinance mit voller Fallback-Kette (§1), letzte Kurse + Datumsfenster |
| `paper/ledger.py` | Event-Sourcing: Transaktionen → Positionen/Cash, deterministisches Replay |
| `paper/engine.py` | Quote/Execute mit harten Validierungen (kein Margin, Gebühren-Deckung) |
| `paper/valuation.py` | Depotwert, P&L, Positionsbewertung aus der Historie |
| `risk/metrics.py` | Vol, HHI, DR, Portfolio-Returns, Max Drawdown – alle mit Namens-Alignment |
| `risk/var.py` | Historischer VaR/CVaR (Score-Basis) + parametrischer CVaR (nur Vergleich) |
| `risk/scoring.py` | Erklärbarer Risk Score mit dokumentierten Ankern/Gewichten, Top-3-Treiber |
| `risk/contribution.py` | Varianzbasierte Risikobeiträge (summieren zu 1) |
| `education/ampel.py` | Drei Ampeln (Klumpen/Diversifikation/Vol) über den Metriken |
| `education/explanations.py` | Statische deutsche Templates + Lernkarten (kein LLM im Kernpfad) |
| `stress/replay.py` | Historische Krisen-Szenarien (3 Presets, Datei-Cache) – s. STRESS_TEST_DECISIONS.md |
| `simulation/monte_carlo.py` | Zukunfts-Fächer per Bootstrap (1/5/10 J., deterministischer Seed) – s. MONTE_CARLO_DECISIONS.md |
| `portfolio/optimization.py` | Max-Sharpe (SLSQP, long-only, 0.6-Cap) |
| `portfolio/upload.py` | CSV-Validierung (§10: Duplikate summiert, deutsche Excel-Dialekte) |
| `ai/news.py` | Google News RSS, key-los, wirft nie |
| `ai/llm_client.py` | LLM-Kaskade: Key/Paket/Parsing-Fehler → Aufrufer fällt zurück |
| `ai/risk_adjustment.py` | Asymmetrische Sentiment-Adjustierung; `assess_market` wirft NIE |
| `ai/guardrails.py` | Runtime-Filter für LLM-Text (Prinzip 3) |

## 2. Bewusst NICHT gebaut (kein Versehen)

- **API-Routen** (`sentinel_api/routers/` + Schemas) – reine Verdrahtung
  der fertigen Core-Funktionen. Der vollständige Vertrag dafür liegt
  bereits in **API_CONTRACT.md** (alle 13 Endpunkte inkl. CSV-Upload,
  Fehlerformat, Konventionen) – dort nichts neu entscheiden, nur umsetzen.
- **Frontend** jenseits des create-next-app-Skeletons.

Diese Session hat gezielt die Teile gebaut, die tiefes Reasoning brauchen
(Risiko-Mathematik, Edge Cases, Guardrails, Architektur-Entscheidungen).
Die verbleibenden Bausteine sind wichtig, aber gut spezifiziert und
mechanisch – sie brauchen Sorgfalt, keine schwierigen Entscheidungen.

## 3. Nicht offensichtliche Entscheidungen – nicht versehentlich brechen

1. **Event-Sourcing konsequent:** Positionen UND Cash werden immer aus
   `start_cash` + Transaktionshistorie berechnet, nie gespeichert.
   Replay sortiert deterministisch nach `(executed_at, id)`;
   `executed_at` ist `AwareDatetime` (naive Timestamps → Validierungsfehler).
   `execute()` lehnt Verkäufe ab, deren Erlös die Gebühr nicht deckt –
   sonst würde ein legitimer Trade die Historie "vergiften" (negatives
   Cash → jedes spätere Replay wirft).
2. **Zweistufige Prinzip-3-Absicherung:** Interne Templates
   (Ampel/Stress) werden durch Test-Regressionswächter geprüft
   (`FORBIDDEN_ACTION_STEMS` in `test_ampel.py`); LLM-Output läuft
   zusätzlich durch den **Runtime**-Filter `ai/guardrails.py` (bewusst
   über-blockend, "sell-off" fliegt mit raus). Reihenfolge beachten:
   Parsing schneidet auf 5 Bullets, DANN filtert der Guardrail.
3. **Ticker-Alignment & Renormalisierung:** Alle Gewichts-/Kovarianz-
   Operationen alignen explizit über Namen (`reindex`), nie über
   Reihenfolge. Es gibt **5 Spalten-Shuffle-Tests** (metrics,
   portfolio_returns, contribution, optimizer, stress) – sie dürfen nie
   entfernt werden (CLAUDE.md Regel 2). Gewichte werden an jedem
   Eintrittspunkt renormalisiert; Aufrufer dürfen Euro-Beträge schicken.
4. **Stress-Replay:** Assets ohne Historie am Fensterstart werden VOR
   der Return-Berechnung ausgeschlossen – `daily_returns` truncated per
   `dropna()` auf die gemeinsame Historie, ein Late-IPO würde sonst das
   Krisenfenster still stauchen. Cache: nur Datei-Ebene (CSV pro
   Preset+Ticker, unveränderlich, kein TTL), negative Ergebnisse als
   leere Marker; Pfad ist aktuell CWD-relativ (`backend/.cache/…`) –
   vor dem API-Deploy env-konfigurierbar machen.
5. **Fehler-Konventionen:** Fachliche Fehler sind durchgängig
   `ValueError` mit **deutschen**, sprechenden Meldungen (Ticker/Beträge
   benennen) – das ist faktisch API-Vertrag. Ausnahme-Familien:
   pydantic `ValidationError` ist eine `ValueError`-Subklasse (passt);
   `ai/`-Einstiegspunkte (`assess_market`, `fetch_headlines`) werfen
   NIE, sondern degradieren neutral. Scoring nutzt den **historischen**
   CVaR (Anker darauf kalibriert) – nie gegen den parametrischen tauschen.

**Umgebungs-Stolperfalle dieser Maschine:** Ein Hintergrund-Tool setzt
Hidden-Flags auf Dotfile-Bäume; Python 3.13 ignoriert dann die
Editable-Install-`.pth` → `ModuleNotFoundError: sentinel_core` außerhalb
von pytest. Lösung: `PYTHONPATH=src` (pytest hat es schon in
`pyproject.toml`). Und: kein `gh` CLI, GitHub-API unauthentifiziert nur
60 req/h – CI-Status über
`https://github.com/mrseacon/Sentinel-Intelligence/actions/workflows/ci.yml/badge.svg` prüfen.

## 4. Nächste Schritte (Priorität)

1. **API-Routen** (`sentinel_api`) exakt nach **API_CONTRACT.md**:
   zuerst `paper/*` + `prices/*` (Kern-Loop, zustandslos), dann
   `risk/analyze` + `risk/ampel`, dann `stress/*`, `simulation/*`,
   `portfolio/optimize`. Dabei: Fehler-Präfix-Registry aus dem Vertrag,
   pydantic-Validierungstexte ins Deutsche mappen, Stress-Cache-Pfad
   konfigurierbar machen. CORS für localhost:3000.
2. **Frontend**: `lib/api.ts` (einziger Ort für Backend-Calls) +
   `lib/types.ts` (Spiegel der Schemas), localStorage mit
   `schema_version` (§7), Depot-Ansicht → Ampel-Ansicht →
   Playwright-Smoke-Test (§9: Trade ausführen → Ampel ändert sich).

Kleinkram, der offen ist: `tests/conftest.py` für die quer-importierten
Test-Helfer (`sample_returns`, `patch_download`, `FORBIDDEN_ACTION_STEMS`);
`daily_returns`-Test für ungleiche Historien.

## 5. Referenzen

- **CLAUDE.md** – Arbeitsregeln (harte Regeln, Commits, Sprache).
- **ARCHITECTURE.md** – alle Grundsatzentscheidungen; §10 enthält die
  offenen Kalibrierungen.
- **STRESS_TEST_DECISIONS.md** / **MONTE_CARLO_DECISIONS.md** –
  Feature-Entscheidungen inkl. Trade-offs.
- **API_CONTRACT.md** – der komplette API-Vertrag (Schemas,
  Fehlerformat, Konventionen) für die Implementierungs-Sessions.
- **KNOWLEDGE_EXTRACTION.md** – Altprojekt-Wissen (read-only); alle
  Fachteile (§1–§12) sind inzwischen portiert.
