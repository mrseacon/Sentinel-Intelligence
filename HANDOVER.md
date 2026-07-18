# HANDOVER – Fachlogik abgeschlossen, bereit für API & Frontend (2026-07-09)

Orientierungshilfe für die nächsten Sessions. **Primäre Referenzen:
CLAUDE.md (Arbeitsregeln), ARCHITECTURE.md (Grundsatzentscheidungen),
API_CONTRACT.md (der komplette API-Vertrag für die nächste Phase).**
Dieses Dokument ist die Landkarte, nicht die Spezifikation.

**Modellwechsel-Hinweis:** Die bisherige Arbeit lief auf Fable; der
Wechsel zu Sonnet für die verbleibende Arbeit ist beabsichtigt und
unproblematisch – alle offenen Design-Fragen sind entschieden und
dokumentiert, was bleibt, ist sorgfältiges Handwerk nach Vertrag.

## 1. Status: Fachlogik-Schicht vollständig

`sentinel_core/` ist komplett und getestet (**146 Tests, CI grün**,
ruff + black sauber). **KNOWLEDGE_EXTRACTION.md §1–§12 ist vollständig
portiert – es gibt keinen offenen Fachteil mehr.**

| Modul | Zweck |
|---|---|
| `constants.py` | EINZIGE Quelle aller fachlichen Konstanten (Anker, Schwellen, Gebühren, Presets, Sim-Parameter) |
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

## 2. Die nächste Phase ist fertig entschieden: API_CONTRACT.md

**API_CONTRACT.md ist die zentrale Referenz für alles Weitere:** alle
13 Endpunkte mit Request-/Response-/Error-Schemas, einheitlichem
`{detail, code}`-Fehlerformat samt Mapping-Registry, Querschnitts-
Konventionen (Zahlen, Zeit, Portfolio-Übergabe) und der Liste, welche
core-Modelle 1:1 durchgereicht werden vs. Wrapper brauchen. Die
Implementierung ist **reines mechanisches Verdrahten pro Endpunkt** –
dort nichts neu entscheiden.

## 3. Nicht offensichtliche Entscheidungen – nicht versehentlich brechen

1. **Event-Sourcing konsequent (paper/):** Positionen UND Cash werden
   immer aus `start_cash` + Transaktionshistorie berechnet, nie
   gespeichert; Replay sortiert deterministisch nach `(executed_at,
   id)`, `executed_at` ist tz-aware Pflicht. `execute()` lehnt Verkäufe
   ab, deren Erlös die Gebühr nicht deckt – sonst vergiftet ein
   legitimer Trade die Historie (negatives Cash → jedes Replay wirft).
2. **Prinzip 3 ist zweistufig absichert:** Interne Templates
   (Ampel/Stress/Simulation) prüft der Test-Regressionswächter
   (`FORBIDDEN_ACTION_STEMS`, `test_ampel.py`); LLM-Output läuft
   zusätzlich durch den **Runtime**-Filter `ai/guardrails.py` (bewusst
   über-blockend, "sell-off" fliegt mit raus). Reihenfolge: Parsing
   schneidet auf 5 Bullets, DANN filtert der Guardrail.
3. **Ticker-Alignment & Renormalisierung überall:** Gewichte/Kovarianz
   alignen explizit über Namen (`reindex`), nie über Reihenfolge;
   Gewichte werden an jedem Eintrittspunkt renormalisiert (Aufrufer
   dürfen €-Beträge schicken – darauf baut der `PortfolioIn`-Vertrag).
   Die **6 Spalten-Shuffle-Tests** (metrics, portfolio_returns,
   contribution, optimizer, stress, simulation) dürfen nie entfernt
   werden (CLAUDE.md Regel 2).
4. **Quant-Entscheidungen mit Begründung:** Monte-Carlo ist ein
   **1-D-Bootstrap auf den Portfolio-Tagesrenditen** – bei konstanten
   Gewichten erhält das die Korrelationen exakt; unabhängiges
   Resampling pro Asset ist der verbotene Fehler (unrealistisch
   schmaler Fächer). Der Optimizer ist long-only mit 0.6-Cap pro
   Position und rf=0 (§11). Das Scoring nutzt den **historischen**
   CVaR (Anker darauf kalibriert) – nie gegen den parametrischen
   tauschen. Konstante heutige Gewichte sind DIE eine
   Portfoliomodell-Annahme in Score, Ampel, Stress UND Simulation.
5. **Fehler-Konvention = API-Vertrag:** Fachliche Fehler sind
   durchgängig deutsche, sprechende `ValueError`s; die API reicht die
   Texte als `detail` durch und mappt den `code` über die
   Präfix-Registry in API_CONTRACT.md §1.1. **Wer eine core-Meldung
   umformuliert, prüft die Registry.** `ai/`-Einstiegspunkte
   (`assess_market`, `fetch_headlines`) werfen NIE – sie degradieren
   neutral (Prinzip 2).

**Umgebungs-Stolperfallen dieser Maschine:** (a) Ein Hintergrund-Tool
setzt Hidden-Flags auf Dotfile-Bäume; Python 3.13 ignoriert dann die
Editable-Install-`.pth` → `ModuleNotFoundError` außerhalb von pytest;
Lösung `PYTHONPATH=src`. (b) Kein `gh` CLI, GitHub-API unauthentifiziert
nur 60 req/h – CI-Status über das Workflow-Badge
(`…/actions/workflows/ci.yml/badge.svg`) prüfen, nie eng pollen.

## 4. Nächste Schritte (Priorität)

1. **API-Routen Modul für Modul nach API_CONTRACT.md verdrahten.**
   Reihenfolge: `paper/*` + `/prices/*` zuerst (meiste Endpunkte, am
   engsten mit dem Frontend-Kern-Loop verzahnt), dann `risk/*`, dann
   `portfolio/*` (optimize + upload), `stress/*`, `simulation/*`.
   Nebenaufgaben aus dem Vertrag: Fehler-Registry, deutsche Übersetzung
   der pydantic-Validierungstexte, Stress-Cache-Pfad env-konfigurierbar,
   CORS für localhost:3000.
2. **Frontend** exakt nach **FRONTEND_DECISIONS.md** (alle 8
   Architektur-Fragen entschieden: TanStack Query, Depot-Hook +
   Context, ErrorNotice/Skeleton-Muster, abgeleitetes Portfolio,
   manuelle types.ts, Recharts-Fächer-Rezept, Seitenstruktur,
   UI-Limits) — dort steht auch die empfohlene Bau-Reihenfolge in
   7 Schritten. Nichts neu entscheiden, nur umsetzen.

**Sicherheits-Audit (erledigt):** Die API ist gegen die kritischen
DoS-/Injection-Vektoren gehärtet — Schutz-Limits in
`sentinel_api/limits.py` (50 Ticker, 10 000 Transaktionen, 2 MB Body,
1 MB CSV streamend), Ticker-Allowlist an jedem Eingang UND im Loader
vor jedem Yahoo-Request, yfinance-Timeout, `SentinelError`-Basisklasse
(fremde `ValueError`s → generischer 500 statt Bibliotheks-Leak),
einheitlicher 500er mit `INTERNAL_ERROR`. Offen als **Deploy-Checkliste
in ARCHITECTURE §8**: CORS/HTTPS/TrustedHost, Proxy-Limits für
Chunked-Bodies, Rate-Limiting, CSV-Injection-Hinweis fürs Frontend.

Kleinkram, der offen ist: `tests/conftest.py` für die quer-importierten
Test-Helfer; `daily_returns`-Test für ungleiche Historien.

## 5. Referenzen

- **CLAUDE.md** – Arbeitsregeln (harte Regeln, Commits, Sprache).
- **ARCHITECTURE.md** – Grundsatzentscheidungen; §10 offene Kalibrierungen.
- **API_CONTRACT.md** – der komplette API-Vertrag (nächste Phase).
- **STRESS_TEST_DECISIONS.md** / **MONTE_CARLO_DECISIONS.md** /
  **FRONTEND_DECISIONS.md** – Feature-/Schicht-Entscheidungen inkl.
  Trade-offs.
- **KNOWLEDGE_EXTRACTION.md** – Altprojekt-Wissen (read-only); alle
  Fachteile (§1–§12) sind portiert.
