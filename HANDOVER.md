# HANDOVER – Sentinel ist eingefroren (2026-10-04)

**Status: Feature-complete, nicht in aktiver Entwicklung.** Das Projekt läuft
ohne Pflege weiter; dieses Dokument sagt, was fertig ist, was offen bleibt
und wie man es nach Monaten wieder zum Laufen bringt.

Primäre Referenzen: **CLAUDE.md** (Arbeitsregeln), **ARCHITECTURE.md**
(Grundsatzentscheidungen, §8 Deploy-Checkliste), **API_CONTRACT.md**
(API-Vertrag). Dieses Dokument ist die Landkarte, nicht die Spezifikation.

## 1. Was ist fertig

- **Fachlogik** (`backend/src/sentinel_core`): vollständig, KNOWLEDGE_EXTRACTION
  §1–§12 portiert. Paper-Engine (Event-Sourcing), Risiko-Score/VaR/CVaR,
  Ampel, Stress-Replay, Monte-Carlo, Optimizer, CSV-Upload, optionale KI.
- **API** (`sentinel_api`): alle Endpunkte nach API_CONTRACT.md, einheitliches
  `{detail, code}`-Fehlerformat, Schutz-Limits (`limits.py`), **Pro-IP-Rate-
  Limit** (`rate_limit.py`, Default 120/min, F9).
- **Frontend** (Next.js App Router, DE/EN): Landing, Depot/Trading, Ampel,
  Stress-Test, Simulation, Analyze + Benchmark, PDF-Report, Demo-Modus,
  Sprachumschalter, Retry-Pfade (inkl. valuation), Hinweis bei Anfragen
  >8 s (Cold-Start).
- **Qualität:** 225 pytest-Tests, ruff + black sauber, 26 Playwright-E2E-
  Tests (Light/Dark), Frontend-Build grün. CI: `.github/workflows/ci.yml`.
- **Reproduzierbarkeit:** alle Versionen exakt gepinnt (s. §3).

## 2. Was ist offen (bewusst nicht gebaut)

- **Phase 2/3** (Accounts, serverseitige Depots/DB, Payments, native App)
  – siehe ARCHITECTURE.md §1/§8. Nichts davon begonnen.
- **Major-Upgrades** (nur vorgeschlagen, nicht durchgeführt): `typescript`
  5→7, `eslint` 9→10, `vitest` 4→5, `@types/node` 20→26,
  `@formatjs/intl-localematcher` 0.8→0.9 (0.x-Minor = potenziell
  brechend), GitHub Actions (`checkout`, `setup-python`, `setup-node`,
  `upload-artifact`, `cache` je auf v6/v7). Transitiv im Backend:
  `websockets` 17 (kommt mit `yfinance` 1.7 – so gepinnt).
- **Bekannte npm-audit-Restfunde (5, nur Dev-Tooling):** die Kette
  `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch →
  braces`. Betrifft nur Lint, nicht den Produktions-Build; `npm audit fix
  --force` würde auf Next 14 *downgraden* – nicht tun, auf ein späteres
  `eslint-config-next` warten.
- **Stress-/Simulation-View:** deren `valuationError`-Zweig hat (noch) kein
  `onRetry` (Depot/Ampel schon).
- **Erklärtexte nur deutsch** in der englischen UI (Backend-Templates).
- **Rate-Limit:** In-Memory pro Prozess, Annahme genau ein Proxy davor
  (ARCHITECTURE §8). Bei mehreren Workern/anderem Hosting prüfen.
- **yfinance ist inoffiziell** – das größte Betriebsrisiko. Fällt Yahoo aus
  oder ändert das Format, liefern alle kursabhängigen Endpunkte
  `UPSTREAM_UNAVAILABLE`; Abhilfe wäre eine andere Datenquelle hinter
  `sentinel_core/data/loader.py`.
- Dependabot ist weiter aktiv (`.github/dependabot.yml`) und wird neue PRs
  öffnen; bei Bedarf abschalten, wenn niemand sie bearbeitet.
- Lizenz: MIT (LICENSE). Namensschutz "Sentinel" ungeprüft (ARCH §10).

## 3. Neu starten (nach Monaten)

Voraussetzungen: Python ≥ 3.11 (CI 3.11, lokal getestet mit 3.13), Node 22.x.

```bash
# Backend (exakt gepinnt: requirements*.txt = kompletter Baum)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt          # Laufzeit allein: requirements.txt
PYTHONPATH=src uvicorn sentinel_api.main:app --reload     # :8000
PYTHONPATH=src pytest && ruff check . && black --check .

# Frontend (package.json exakt gepinnt, .npmrc: save-exact)
cd frontend
npm ci                                       # nicht `npm install`
npm run dev                                  # :3000
npm run build && npm test && npm run test:e2e
```

`PYTHONPATH=src` statt Editable-Install ist Absicht (macOS-Hidden-Flag-
Problem mit `.pth` in `.venv`, siehe `pyproject.toml`).
Pins bewusst ändern: `pyproject.toml` (direkte Deps) UND
`requirements*.txt` (kompletter Baum) gemeinsam aktualisieren, in einem
frischen venv neu auflösen, dann alle Tests + E2E laufen lassen.

### Umgebungsvariablen

| Variable | Wo | Zweck |
|---|---|---|
| `ALLOWED_ORIGINS` | Backend | CORS, kommagetrennt. Produktion: Vercel-Domain. Default `http://localhost:3000` |
| `TRUSTED_HOSTS` | Backend | Host-Header-Allowlist. Default `*` |
| `SENTINEL_RATE_LIMIT_PER_MINUTE` | Backend | Pro-IP-Limit, Default 120, `0` = aus |
| `SENTINEL_AI_ENABLED` | Backend | KI-Markteinschätzung, Default `false` (Kostenschranke) |
| `ANTHROPIC_API_KEY` | Backend | nur bei `SENTINEL_AI_ENABLED=true` |
| `SENTINEL_LLM_MODEL` | Backend | optionales Modell-Override |
| `STRESS_CACHE_DIR` | Backend | optional, beschreibbarer Cache-Pfad für Stress-Preise |
| `NEXT_PUBLIC_API_URL` | Frontend (Build-Zeit!) | Backend-URL, Default `http://localhost:8000` |
| `NEXT_PUBLIC_SITE_URL` | Frontend | Basis-URL für SEO/OG, optional |

Referenzdateien: `backend/.env.example`, `frontend/.env.local.example`.
`NEXT_PUBLIC_*` wird beim Build eingebacken – Änderung braucht Redeploy.

### Deploy (aktueller Stand)

- **Frontend:** Vercel, Root-Verzeichnis `frontend/`, Env `NEXT_PUBLIC_API_URL`
  auf die Backend-URL. Live: sentinel-intelligence-delta.vercel.app.
  `engines.node` = 22.x.
- **Backend:** Render (Free-Tier), `render.yaml` im Repo-Root: Build
  `pip install -r requirements.txt`, Start
  `PYTHONPATH=src uvicorn sentinel_api.main:app --host 0.0.0.0 --port $PORT`.
  Env-Variablen im Render-Dashboard setzen (`ALLOWED_ORIGINS`,
  `TRUSTED_HOSTS`). Alternative Railway: `backend/railway.json` + `Procfile`.
  Free-Tier schläft ein → Cold-Start bis ~60 s (Frontend zeigt Hinweis).
- Deploy-Checkliste Sicherheit: ARCHITECTURE.md §8.

## 4. Nicht offensichtliche Entscheidungen – nicht versehentlich brechen

1. **Event-Sourcing (paper/):** Positionen und Cash werden immer aus
   `start_cash` + Transaktionen berechnet, nie gespeichert; Replay sortiert
   nach `(executed_at, id)`, `executed_at` ist tz-aware. `execute()` lehnt
   Verkäufe ab, deren Erlös die Gebühr nicht deckt (sonst negatives Cash,
   jedes Replay würfe).
2. **Prinzip 3 (keine Anlageempfehlung) ist zweistufig:** Test-Wächter
   (`FORBIDDEN_ACTION_STEMS`) für Templates + Runtime-Filter
   `ai/guardrails.py` für LLM-Text. Reihenfolge: auf 5 Bullets schneiden,
   DANN filtern.
3. **Ticker-Alignment & Renormalisierung überall:** Gewichte/Kovarianz über
   Namen (`reindex`), nie über Reihenfolge; Gewichte an jedem Eintritts-
   punkt renormalisieren. Die 6 Spalten-Shuffle-Tests nie entfernen.
4. **Quant:** Monte-Carlo = 1-D-Bootstrap auf Portfolio-Tagesrenditen (nie
   Asset-weises Resampling); Optimizer long-only, 0.6-Cap, rf=0; Scoring
   nutzt den *historischen* CVaR; konstante heutige Gewichte in Score,
   Ampel, Stress und Simulation.
5. **Fehler-Konvention = API-Vertrag:** deutsche, sprechende `ValueError`s
   aus core; `code` per Präfix-Registry (`errors.py`, API_CONTRACT §1.1).
   Wer eine core-Meldung umformuliert, prüft die Registry. Ein neuer
   Backend-Code braucht einen Eintrag in `frontend/lib/i18n/error-messages.en.ts`
   (Vollständigkeitstest in vitest erzwingt das). `ai/`-Einstiegspunkte
   werfen nie (Graceful Degradation); KI ist per Default AUS.
6. **Middleware-Reihenfolge in `main.py`:** CORS muss die äußerste Schicht
   sein (zuletzt registrieren), sonst fehlen CORS-Header bei 400/413/429
   und der Browser meldet nur "CORS error".

**Umgebungs-Stolperfallen der Entwicklungsmaschine:** (a) macOS-Hidden-Flag
auf `.venv`-Dateien → `PYTHONPATH=src` nutzen. (b) Kein `gh`-CLI; GitHub-API
unauthentifiziert 60 req/h – CI-Status über das Workflow-Badge prüfen, nie
eng pollen.

## 5. Referenzen

- **CLAUDE.md** – Arbeitsregeln · **ARCHITECTURE.md** – Grundsatzent-
  scheidungen · **API_CONTRACT.md** – API-Vertrag
- **STRESS_TEST_DECISIONS.md** / **MONTE_CARLO_DECISIONS.md** /
  **FRONTEND_DECISIONS.md** / **I18N_DECISIONS.md** – Feature-Entscheidungen
- **KNOWLEDGE_EXTRACTION.md** – Altprojekt-Wissen (read-only, vollständig portiert)
