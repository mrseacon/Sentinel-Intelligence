# Sentinel – Architektur (v1)

Referenzdokument für den Neubau. Jede Entwicklungs-Session (Claude oder Mensch)
liest dieses Dokument zuerst. Änderungen an Grundsatzentscheidungen werden hier
dokumentiert, nicht stillschweigend im Code getroffen.

Stand: 2026-07-04 · Basis: KNOWLEDGE_EXTRACTION.md (Fachwissen aus Altprojekt)

---

## 1. Produktvision & Leitplanken

**Sentinel** führt Einsteiger vom ersten Spielgeld-Trade bis zum verstandenen
realen Portfolio. Kern-Loop:

> Paper-Depot aufbauen → Risiko-Ampel erklärt Schwächen (Klumpenrisiko,
> Diversifikation, Volatilität) → Nutzer lernt und passt an → Wissen fürs
> echte Investieren aufgebaut.

**Unverhandelbare Designprinzipien** (aus Altprojekt übernommen + neu):

1. **Erklärbarkeit vor Präzision.** Jede Risikozahl hat eine verständliche
   Begründung. Keine Black-Box-Scores. (Altprojekt §5)
2. **Graceful Degradation.** Ohne LLM-Key, ohne News, ohne Internet bleibt der
   Kern nutzbar. (Altprojekt §8, §14)
3. **Keine Anlageberatung.** Die Ampel beschreibt Portfolioeigenschaften
   ("hohe Konzentration in einem Wert"), nie Handlungsempfehlungen für
   konkrete Wertpapiere ("kaufe X"). Disclaimer fest in der UI. Rechtlich
   relevant für Betrieb aus Deutschland.
4. **Bildung zuerst, Realismus zweitens.** 15-min-verzögerte Kurse sind
   akzeptiert und werden transparent angezeigt.

**Nicht-Ziele v1:** Native App (erst Phase 3 via Capacitor), Payments,
Echtzeit-Kurse, Orderarten jenseits Market-Order, Derivate/Krypto.

---

## 2. Systemüberblick

```
┌────────────────────────┐         ┌─────────────────────────────┐
│  Frontend               │  HTTPS  │  Backend                     │
│  Next.js + TypeScript   │ ──────► │  FastAPI (Python 3.11+)      │
│  (PWA-fähig)            │  JSON   │                              │
└────────────────────────┘         │  ┌────────────────────────┐  │
                                   │  │ sentinel-core (Paket)   │  │
        Phase 1: Depot lokal       │  │ Fachlogik, UI-frei      │  │
        (localStorage)             │  └────────────────────────┘  │
        Phase 2: Depot im Backend  │  SQLite → Postgres (Phase 2) │
                                   └─────────────────────────────┘
                                              │
                                    yfinance · Google News RSS
                                    LLM-API (optional)
```

**Drei strikt getrennte Schichten:**

| Schicht | Technologie | Verantwortung |
|---|---|---|
| `sentinel-core` | Reines Python-Paket | Risiko-Mathematik, Paper-Trading-Engine, Datenbeschaffung. Kennt weder HTTP noch UI. |
| `sentinel-api` | FastAPI | HTTP-Endpunkte, Validierung (Pydantic), Auth (Phase 2), Persistenz |
| `sentinel-web` | Next.js | Darstellung, Ampel-UI, Depot-Interaktion |

Regel: **Fachlogik lebt ausschließlich in `sentinel-core`.** Die API ruft sie
nur auf. Das macht den Kern testbar, wiederverwendbar (spätere App nutzt
dieselbe API) und ist die Lehre aus dem Streamlit-Monolithen.

---

## 3. Repository-Struktur (Monorepo)

```
sentinel/
├── ARCHITECTURE.md
├── KNOWLEDGE_EXTRACTION.md        # Fachwissen Altprojekt (read-only Referenz)
├── CLAUDE.md                      # Arbeitsanweisungen für Claude-Sessions
├── backend/
│   ├── pyproject.toml
│   ├── src/sentinel_core/
│   │   ├── constants.py           # TRADING_DAYS=252 u.a. – EINE Quelle (fix Altprojekt §2)
│   │   ├── data/loader.py         # yfinance inkl. Fallback-Kette (Altprojekt §1 komplett übernehmen)
│   │   ├── risk/                  # metrics, var, scoring, contribution
│   │   ├── portfolio/             # model, optimization, upload
│   │   ├── paper/                 # NEU: engine, ledger, valuation
│   │   ├── education/             # NEU: ampel.py, explanations.py
│   │   └── ai/                    # llm_client, news, risk_adjustment
│   ├── src/sentinel_api/
│   │   ├── main.py
│   │   ├── routers/               # prices, risk, paper, education
│   │   └── schemas/               # Pydantic-Modelle = API-Vertrag
│   └── tests/
├── frontend/
│   ├── app/                       # Next.js App Router
│   │   ├── (learn)/depot/         # Paper-Trading-Ansicht
│   │   ├── (learn)/ampel/         # Risiko-Ampel & Erklärungen
│   │   └── analyze/               # klassische Analyse (Altfunktion)
│   ├── components/                # NUR wiederverwendete Bausteine
│   ├── lib/api.ts                 # EINZIGER Ort für Backend-Calls
│   └── lib/types.ts               # TS-Typen, gespiegelt aus Pydantic
└── .github/workflows/ci.yml      # ruff + black + pytest (wie Altprojekt §15)
```

Frontend-Leitplanken (wegen Frontend-Einstieg): App Router, Tailwind,
**keine** zusätzliche State-Library (React-State + localStorage reicht v1),
Charts mit Recharts, alle API-Zugriffe nur über `lib/api.ts`.

---

## 4. Datenmodell

### 4.1 Paper-Trading (Kern-Neuheit)

```
PaperAccount            Transaction                Position (abgeleitet!)
─────────────           ─────────────              ────────────────────
id                      id                         ticker
name                    account_id                 quantity
start_cash (10_000 €)   ticker                     avg_buy_price
cash                    side (BUY|SELL)            (berechnet aus
created_at              quantity                    Transaktionen –
                        price   ← Kurs z. Zeitpunkt  nie gespeichert)
                        fees    ← 1 € Pauschale
                        executed_at
```

**Entscheidungen:**
- **Event-Sourcing light:** Positionen werden immer aus der
  Transaktionshistorie berechnet, nie als Zustand gespeichert. Verhindert
  Inkonsistenzen, ermöglicht Depot-Historie/Chart "umsonst" und ist das
  didaktisch ehrlichste Modell.
- **Pauschalgebühr 1 €/Trade:** Lehrt, dass Traden kostet, ohne komplex zu
  werden. Konstante in `constants.py`.
- Ausführungspreis = letzter verfügbarer (verzögerter) Kurs; wird in der
  Transaktion eingefroren und in der UI als "Kurs von HH:MM" angezeigt.
- Verkauf > Bestand und Kauf > Cash sind harte Fehler (kein Margin).
- Phase 1: `PaperAccount` + Transaktionen liegen als JSON in
  `localStorage` (Schema identisch zum Backend-Modell → Migration in
  Phase 2 ist reiner Datenimport). Phase 2: SQLite/Postgres via SQLModel.

### 4.2 Risiko-Berechnung

Übernahme der Konventionen aus dem Altprojekt, mit zwei bewussten Fixes:

- **Fix der unsichtbaren Invariante (Altprojekt §3):** Alle
  Portfolio-Risikofunktionen alignen Gewichte und Kovarianzmatrix
  **explizit über Ticker-Namen** (`weights_series.reindex(cov.columns)`),
  nie über implizite Dict-Reihenfolge. Ein Test erzwingt das (bewusst
  verwürfelte Spaltenreihenfolge muss identisches Ergebnis liefern).
- **Eine Konstanten-Quelle:** `TRADING_DAYS`, Score-Anker und -Gewichte,
  Ampel-Schwellen leben ausschließlich in `constants.py`.
- Unverändert übernehmen: simple returns (pct_change), ddof=1,
  VaR/CVaR-Vorzeichenkonvention (negativ im Return-Raum), CVaR-Fallback auf
  VaR bei leerem Tail, Invariante CVaR ≤ VaR als Test, Score-Anker und
  Gewichtung (0.30/0.30/0.20/0.15/0.05), asymmetrische AI-Adjustierung.

---

## 5. Risiko-Ampel (Education-Schicht)

Die Ampel ist eine **Präsentationsschicht über dem bestehenden Risk Score**,
keine neue Mathematik. Drei Ampeln, jeweils mit Grün/Gelb/Rot + Erklärtext +
"Was heißt das?"-Lernkarte:

| Ampel | Basis-Metrik (bereits vorhanden) | Schwellen (v1, kalibrierbar) |
|---|---|---|
| Klumpenrisiko | HHI (Altprojekt §6) | ≤0.15 grün · ≤0.30 gelb · >0.30 rot |
| Diversifikation | Diversification Ratio + Anzahl Positionen | DR ≥1.3 & ≥5 Pos. grün · DR ≥1.1 gelb · sonst rot |
| Volatilität | annualisierte Portfolio-Vol | ≤15 % grün · ≤25 % gelb · >25 % rot |

**Regeln:**
- Jede Ampel liefert strukturiert: `status`, `value`, `explanation`
  (was ist gerade in *deinem* Depot los, mit konkretem Auslöser: "42 % deines
  Depots stecken in NVDA"), `lesson` (allgemeine Lernkarte, statischer
  Content).
- Erklärtexte sind **statische Templates mit eingesetzten Zahlen** –
  kein LLM-Zwang im Kernpfad (Prinzip 2). LLM darf sie in Phase 2 optional
  anreichern.
- Formulierungen beschreibend, nie imperativ bzgl. konkreter Titel
  (Prinzip 3).
- Schwellen sind fachliche Entscheidungen wie die Score-Anker im Altprojekt:
  dokumentiert in `constants.py` mit Begründungskommentar.

---

## 6. API-Grenzen (v1-Endpunkte)

```
GET  /prices/{ticker}                Kurs + Zeitstempel (verzögert)
GET  /prices/history?tickers=&period=

POST /risk/analyze                   Portfolio → Metriken + Score + Treiber
POST /risk/ampel                     Portfolio → 3 Ampeln inkl. Texte
POST /portfolio/optimize             Max-Sharpe (Constraints wie Altprojekt §11)

POST /paper/quote                    Ticker+Menge → Vorschau (Preis, Gebühr, Cash danach)
POST /paper/execute                  Transaktion validieren & "ausführen"
POST /paper/valuation                Transaktionsliste → Positionen, Depotwert, P&L
```

- Phase 1 sind `paper/*`-Endpunkte **zustandslos**: Das Frontend sendet die
  lokal gespeicherte Transaktionsliste mit, das Backend rechnet nur. Dadurch
  null Persistenz-/DSGVO-Aufwand in Phase 1, und in Phase 2 wandert nur die
  Speicherung ins Backend – die Rechenlogik bleibt identisch.
- Pydantic-Schemas sind der Vertrag; TS-Typen in `lib/types.ts` spiegeln sie
  1:1 (v1 manuell gepflegt, später ggf. Codegen aus OpenAPI).
- Fehler konsistent als `{detail, code}`; sprechende Meldungen wie im
  Altprojekt (fehlende Ticker explizit benennen, §1).

---

## 7. Auth & DSGVO (Phase 2, aber jetzt vorbereitet)

- **Phase 1: bewusst keine Accounts, keine personenbezogenen Daten** →
  minimale DSGVO-Fläche (nur Impressum/Datenschutzerklärung fürs Hosting).
- Phase 2: E-Mail + Passwort via etablierter Library (fastapi-users o.ä.),
  Sessions als httpOnly-Cookies. Kein Social Login in v1.
- Vorbereitung jetzt: alle Paper-Modelle tragen bereits `account_id`-Felder;
  EU-Hosting wählen (Railway/Render EU-Region, Vercel eu-central);
  localStorage-Schema versioniert (`schema_version`), damit der spätere
  Import ins Backend trivial ist.

---

## 8. Skalierungs- & Ausbaupfad

| Phase | Inhalt | Infrastruktur |
|---|---|---|
| 1 (~2–3 Monate, 5–10 h/W) | Analyse + Paper-Trading lokal + Ampel | Vercel (Frontend), Railway/Render (API), keine DB |
| 2 | Accounts, Depots serverseitig, PWA-Feinschliff, LLM-Erklärungen | + Postgres, Auth |
| 3 (bei Nachfrage) | Capacitor-App, evtl. Freemium | Stores, Payments |

Bewusst verschoben: Preis-Caching-Layer (erst wenn yfinance-Latenz nervt),
WebSockets, mehrere Depots pro Nutzer, Benchmarks/Vergleichsindizes.

---

## 9. Qualitätssicherung

- CI wie Altprojekt (§15): ruff (E,F,I,B,UP) + black + pytest, Python ≥3.11.
- **Pflicht-Testfälle aus der Knowledge Extraction:** yfinance-Formatfälle
  (Single-Ticker-Series, MultiIndex, fehlendes Adj Close), CVaR ≤ VaR,
  leerer Tail → VaR-Fallback, HHI-Selbstnormalisierung, Spalten-Shuffle-Test
  (§4.2), Optimierer-Constraints, Gewichts-Renormalisierung an jedem
  Eintrittspunkt.
- **Neue Pflicht-Tests Paper-Engine:** Verkauf > Bestand, Kauf > Cash,
  Positions-Berechnung aus Transaktionen (inkl. Teilverkäufe,
  avg_buy_price), Gebührenwirkung auf Cash, Ampel-Schwellen-Grenzfälle.
- Frontend v1: Playwright-Smoke-Test für den Kern-Loop
  (Trade ausführen → Ampel ändert sich), nicht mehr.

---

## 10. Offene Entscheidungen (bewusst vertagt)

- Exakte Ampel-Schwellen validieren (mit echten Beispiel-Depots kalibrieren)
- LLM-Provider für Phase 2 (Kaskaden-Muster aus Altprojekt §8 übernehmen)
- Codegen Pydantic→TypeScript ab wann
- Namensschutz/Marke "Sentinel" prüfen, bevor es öffentlich Business wird
