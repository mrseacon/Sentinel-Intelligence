# Sentinel

**Portfolio-Risiko verstehen, nicht nur berechnen.**

Sentinel ist ein Lern-Tool für Einsteiger:innen, die Portfoliorisiko wirklich
verstehen wollen, statt nur eine Kennzahl zu sehen. Mit virtuellem Spielgeld
ein Depot aufbauen, zu echten (verzögerten) Kursen handeln, und dabei in
verständlicher Sprache erklärt bekommen, wo die eigenen Risiken liegen.

> ⚠️ Sentinel ist ein Lern- und Übungstool. Nichts in der App ist eine
> Anlageberatung oder Kaufempfehlung für konkrete Wertpapiere.

---

## Was Sentinel kann

- 📈 **Paper-Trading** – Depot mit virtuellem Startkapital, Trades zu echten
  Marktkursen, vollständige Positions- und P&L-Historie
- 🚦 **Erklärbare Risiko-Ampel** – Klumpenrisiko, Diversifikation und
  Volatilität verständlich erklärt statt als Black-Box-Zahl
- 📉 **Historischer Stress-Test** – wie hätte sich dein aktuelles Depot in
  der Finanzkrise 2008, dem Corona-Crash 2020 oder der Zinswende 2022
  entwickelt?
- 🎲 **Monte-Carlo-Zukunftssimulation** – Bandbreite plausibler
  Wertentwicklungen über 1/5/10 Jahre, auf Basis echter historischer
  Tagesrenditen
- 🧮 **Unabhängige Portfolio-Analyse** – Ticker manuell eingeben oder CSV
  hochladen, Risiko-Score samt Treibern berechnen
- ⚖️ **Portfolio-Optimierung** – Max-Sharpe-Gewichtsvorschlag (Long-only,
  mit Positionsobergrenze)
- 🤖 **Optionale KI-Markteinschätzung** – Sentiment-gestützte Anpassung,
  standardmäßig deaktiviert (siehe [KI-Funktion](#ki-funktion))

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Backend | Python, FastAPI, Pydantic, NumPy/SciPy/pandas |
| Frontend | Next.js, TypeScript, TanStack Query, Recharts, Tailwind |
| Daten | yfinance (Marktdaten), Google News RSS (optional, KI-Kontext) |
| Tests | pytest (Backend, 190+ Tests), TypeScript strict mode |

## Architektur

Das Projekt ist als sauber getrenntes Monorepo aufgebaut:

```
sentinel/
├── backend/
│   ├── src/sentinel_core/     # Fachlogik – UI-/HTTP-frei, vollständig getestet
│   └── src/sentinel_api/      # FastAPI-Schicht – reines Verdrahten, keine Fachlogik
└── frontend/                  # Next.js App Router, TypeScript
```

Ausführliche Dokumentation der Design-Entscheidungen:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) – Gesamtarchitektur, Datenmodell, API-Grenzen
- [`API_CONTRACT.md`](./API_CONTRACT.md) – vollständiger Endpunkt- und Fehlerformat-Vertrag
- [`FRONTEND_DECISIONS.md`](./FRONTEND_DECISIONS.md) – State-Management, Routing, Charting
- [`STRESS_TEST_DECISIONS.md`](./STRESS_TEST_DECISIONS.md) / [`MONTE_CARLO_DECISIONS.md`](./MONTE_CARLO_DECISIONS.md) – Feature-spezifische Entscheidungen

Jede fachliche Regel (Risikoformeln, Fallback-Verhalten, Edge Cases) ist mit
Begründung dokumentiert, nicht nur implementiert – Ziel ist Nachvollziehbarkeit,
nicht nur Funktionalität.

## Lokal starten

**Backend:**
```bash
cd backend
pip install -e ".[dev]" --break-system-packages
PYTHONPATH=src uvicorn sentinel_api.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend läuft dann auf `http://localhost:3000`, Backend auf
`http://localhost:8000`.

## Tests

```bash
# Backend
cd backend && pytest && ruff check . && black --check .

# Frontend
cd frontend && npm run build
```

## KI-Funktion

Die optionale KI-Markteinschätzung nutzt Claude (Anthropic API) für eine
Sentiment-gestützte Risikoanpassung. Sie ist **standardmäßig deaktiviert**
(`SENTINEL_AI_ENABLED=false`), damit in diesem öffentlichen Repository keine
unbeabsichtigten API-Kosten entstehen. Zum Aktivieren:

```bash
SENTINEL_AI_ENABLED=true
ANTHROPIC_API_KEY=dein-key
```

Ohne aktivierten Key liefert die App durchgehend ein neutrales Ergebnis –
kein Feature funktioniert eingeschränkt oder bricht.

## Projektstatus

Solo-Side-Project neben dem Wirtschaftsinformatik-Studium. Backend und
Frontend sind funktional vollständig (Kern-Loop Depot → Ampel → Stress-Test →
Simulation sowie unabhängige Analyse/Optimierung). Aktueller Fokus: Deployment
und Politur.

## Lizenz

_Noch festzulegen._
