# CLAUDE.md – Sentinel

Arbeitsanweisungen für jede Claude-Session in diesem Repo. Bei Konflikten
gilt: ARCHITECTURE.md > dieses Dokument > Ad-hoc-Anweisungen im Chat, außer
der Nutzer entscheidet explizit anders (dann ARCHITECTURE.md aktualisieren!).

## Pflichtlektüre vor jeder Aufgabe

1. **ARCHITECTURE.md** – alle Grundsatzentscheidungen (Schichten, Datenmodell,
   API-Vertrag, Phasen). Nichts bauen, was Phase-2/3-Scope in Phase 1 zieht.
2. **KNOWLEDGE_EXTRACTION.md** – Fachwissen aus dem Altprojekt. Bei Arbeit an
   Loader, Risiko-Mathematik, VaR/CVaR, Scoring oder News-Pipeline die
   dortigen Regeln übernehmen, nicht neu erfinden.

## Projektkontext

- Solo-Projekt eines Wirtschaftsinformatik-Studenten, 5–10 h/Woche neben der
  Uni. Erst eigenes Tool + Showcase, perspektivisch B2C-Business.
- Kernprodukt: Lern-Loop Paper-Trading → Risiko-Ampel → Verständnis →
  reales Portfolio.
- Betrieb aus Deutschland: **nie Anlageempfehlungen für konkrete Titel
  formulieren** – weder im Code (Erklärtexte!) noch in generierten Inhalten.
  Ampel & Texte beschreiben Portfolioeigenschaften, imperativ nur bzgl.
  Konzepten ("Diversifikation senkt…"), nie bzgl. Wertpapieren.

## Stack & Struktur (Kurzfassung)

- `backend/src/sentinel_core` – reine Fachlogik, kennt kein HTTP/UI
- `backend/src/sentinel_api` – FastAPI, Pydantic-Schemas = API-Vertrag
- `frontend/` – Next.js App Router + TypeScript + Tailwind + Recharts
- Python ≥ 3.11, moderne Typannotationen (`X | None`), keine 3.12+-Features
- Konstanten (TRADING_DAYS, Score-Anker, Ampel-Schwellen, Gebühren) leben
  **ausschließlich** in `sentinel_core/constants.py`

## Harte Regeln

1. **Fachlogik nur in `sentinel_core`.** Wenn eine API-Route oder React-
   Komponente anfängt zu rechnen, ist das ein Architekturfehler.
2. **Gewichts-/Kovarianz-Alignment immer explizit über Ticker-Namen**
   (reindex), nie über Dict- oder Spaltenreihenfolge. Der Spalten-Shuffle-
   Test darf nie entfernt werden.
3. **Gewichte an jedem Eintrittspunkt defensiv renormalisieren.**
4. VaR/CVaR-Konventionen aus KNOWLEDGE_EXTRACTION §4 sind fix (negative
   Return-Werte, CVaR≤VaR, Tail `<=`, leerer Tail → VaR).
5. **Graceful Degradation:** Kein Feature darf hart von LLM-Key, News oder
   Internet abhängen; immer nutzbarer Fallback.
6. Paper-Engine: Positionen werden aus Transaktionen berechnet, nie als
   Zustand gespeichert. Kauf > Cash und Verkauf > Bestand sind harte Fehler.
7. Phase-1-`paper/*`-Endpunkte bleiben zustandslos (Transaktionsliste kommt
   vom Client).
8. Neue fachliche Konstante/Schwelle → mit Begründungskommentar in
   `constants.py` + Erwähnung in ARCHITECTURE.md §10, falls unkalibriert.

## Arbeitsweise

- Nutzer hat Python/C#/SQL-Erfahrung, **Frontend-Neuling**: Bei React/TS-Code
  kurz erklären, *warum* ein Muster so aussieht (1–2 Sätze, keine Essays);
  etablierte, einfache Muster bevorzugen; keine zusätzlichen State-Libraries.
- Vor größeren Aufgaben kurzen Plan zeigen, dann umsetzen.
- Tests gehören zur Definition of Done – mindestens die Pflichtfälle aus
  ARCHITECTURE.md §9 für den berührten Bereich.
- Lint/Format: ruff (E,F,I,B,UP) + black; CI muss grün bleiben.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, …),
  Subject < 70 Zeichen, imperativ.
- Deutsch im Chat, Englisch in Code, Kommentaren, Commits und Docs
  (Ausnahme: nutzerseitige UI-Texte und Lerninhalte sind Deutsch).

## Befehle

```bash
# Backend
cd backend && pip install -e ".[dev]"
pytest                      # Tests
ruff check . && black --check .

# Frontend
cd frontend && npm install
npm run dev                 # http://localhost:3000
npm run build               # muss vor jedem PR/Push durchlaufen
```

## Was NICHT tun

- Keine Features aus Phase 2/3 "mal eben mitbauen" (Auth, DB, Payments,
  native App) – erst ARCHITECTURE.md-Änderung mit dem Nutzer beschließen.
- Keine neuen Dependencies ohne kurze Begründung (Bundle-/Wartungskosten).
- Keine Platzhalter-Module anlegen ("kommt später") – Lehre aus dem
  Altprojekt (§16: leere Dateien wurden nie gefüllt).
- Keine stillen Änderungen an Score-Ankern, Gewichten oder Ampel-Schwellen.
