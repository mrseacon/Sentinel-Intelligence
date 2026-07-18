# Frontend – Architektur-Entscheidungen (v1)

Status: **Freigegeben am 2026-07-12** (alle 8 Punkte inkl. der
TanStack-Query-Ausnahme) · Zielgruppe: die Bau-Session (Sonnet), die
danach mechanisch umsetzt, ohne diese Fragen neu zu entscheiden.
Referenzen: ARCHITECTURE.md §1/§3, API_CONTRACT.md (Schemas, Limits,
Fehlerformat), CLAUDE.md (Nutzer ist Frontend-Neuling: bei
Gleichwertigkeit gewinnt die geringere Lernkurve).

---

## 1. Server-State: TanStack Query (dokumentierte Ausnahme)

**Empfehlung:** `@tanstack/react-query` als einzige neue Dependency für
den Server-Cache. Ein `QueryClientProvider` (Client-Komponente) im
Root-Layout. Konventionen:

- **Query-Keys deterministisch:** `[domäne, endpunkt, canonicalWeights,
  ...params]`, wobei `canonicalWeights` = JSON der **sortierten**
  Gewichts-Einträge. Identisches Portfolio ⇒ identischer Key ⇒ Ampel-,
  Stress- und Simulations-View teilen sich denselben Cache-Eintrag und
  lösen zusammen genau EINEN yfinance-Call aus (in-flight-Deduplizierung
  inklusive).
- **`staleTime: 15 Minuten`** für alle 🐢-Endpunkte — deckt sich bewusst
  mit den 15-min-verzögerten Kursen aus ARCHITECTURE §1: häufigeres
  Refetchen kann gar keine neueren Daten liefern.
- **POST-als-Query:** Die Analyse-Endpunkte sind semantisch Reads
  (POST nur wegen des Portfolio-Bodys) → als Query modellieren.
  Echte **Mutations** nur für `paper/execute` und `portfolio/upload`.
- **Retry:** genau 1 Retry, und nur bei `code === "UPSTREAM_UNAVAILABLE"`
  — fachliche 422er erneut zu senden ist sinnlos.

**Begründung:** Die Kernanforderung — mehrere Views, dieselben Daten,
teure Upstream-Calls — IST das Problem, für das Server-Cache-Libraries
gebaut wurden. Mit `useState`+`fetch` müsste ein Anfänger einen eigenen
Cache samt Deduplizierung, Invalidierung und Race-Behandlung
(fetch-in-useEffect-Fallen, Cleanup, Strict-Mode-Doppelmounts) von Hand
bauen — das ist die fehleranfälligste Ecke von React überhaupt.
TanStack Query macht daraus deklarative `isPending`/`error`/`data`-Flags
mit exzellenten Docs und Devtools.

**Abgrenzung zur Leitplanke:** Die ARCHITECTURE-§3-Regel meinte
Client-State-Frameworks (Redux/Zustand/Jotai). TanStack Query verwaltet
keinen App-Zustand, sondern einen **Cache über Server-Antworten** —
Client-State bleibt bei React-Bordmitteln (s. §2). Die Leitplanke wurde
in ARCHITECTURE §3 entsprechend präzisiert.

**Trade-offs:** *SWR* wäre gleichwertig fürs Caching, hat aber die
schwächere Mutations-/Invalidierungs-Story (relevant für
execute→valuation-refresh) und weniger explizite Key-Semantik.
*useState+fetch* hätte null Dependencies, aber die oben beschriebenen
Handbau-Kosten und doppelte yfinance-Calls als Default-Verhalten.
Bundle-Kosten TanStack: ~13 kB gzip — akzeptiert.

---

## 2. Client-State Paper-Depot: Custom Hook + dünner Context

**Empfehlung:** Kein Zustand/Redux. Drei kleine Bausteine:

1. `lib/depot-storage.ts` — reines Lese/Schreib-Modul für localStorage:
   `{ schema_version: 1, account: PaperAccountIn, transactions:
   TransactionIO[] }`. Versionierung per `switch(schema_version)`-
   Migrationstabelle (ARCHITECTURE §7: der Phase-2-Import ins Backend
   soll trivial sein). Kein React-Import in dieser Datei.
2. `usePaperDepot()` — DER eine State-Besitzer: hält den Depot-Zustand
   in `useState`, synchronisiert bei jeder Änderung nach localStorage,
   bietet `executeTrade()` (ruft die execute-Mutation, hängt die
   zurückgegebene Transaktion an — Event-Sourcing bleibt clientseitig,
   API_CONTRACT §2.8) und `resetDepot()`.
3. `DepotProvider` — hauchdünner, **eingebauter** React-Context im
   `(learn)/layout.tsx`, der den Hook-Wert verteilt. Ohne Context hätten
   mehrere Komponenten eigene, desynchrone Hook-Instanzen.

**SSR-Gotcha (wichtig für die Bau-Session):** localStorage existiert
nur im Browser. Der Hook initialisiert mit `null` ("Depot lädt") und
liest erst im `useEffect` — sonst Hydration-Mismatch zwischen Server-
und Client-Render. Alle Depot-Komponenten brauchen `"use client"`.

**Trade-offs:** Eine Zustand-Library spart ~30 Zeilen Boilerplate,
verletzt aber die Leitplanke und fügt ein Konzept hinzu, das der Nutzer
lernen müsste. Context-Rerender-Bedenken sind bei dieser Datenmenge
(ein Depot, <10k Transaktionen) irrelevant.

---

## 3. Fehler- & Loading-Strategie

**Empfehlung:** Ein Typ, eine Komponente, eine Verhaltens-Tabelle.

- `lib/api.ts` wirft bei !ok ein typisiertes `ApiError { status, code,
  detail }` (Response-Body ist laut Contract immer `{detail, code}`).
- **Das deutsche `detail` wird IMMER unverändert angezeigt** — die Texte
  sind serverseitig kuratiert (API_CONTRACT §1.4), das Frontend baut
  keine eigene Fehlertext-Tabelle. Der `code` steuert nur **Ort und
  Verhalten**:

| Kategorie | Codes | UI-Verhalten |
|---|---|---|
| Retry sinnvoll | `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` | `<ErrorNotice variant="banner">` mit "Erneut versuchen"-Button |
| Nutzer kann es beheben | `TICKER_NOT_FOUND`, `TICKER_INVALID`, `PAPER_*`, `LEDGER_INCONSISTENT`, `PORTFOLIO_INVALID`, `UPLOAD_INVALID`, `STRESS_*`, `SIM_*`, `OPTIMIZER_*`, `VALIDATION_ERROR` | `<ErrorNotice variant="inline">` direkt am auslösenden Formular/Dialog |
| Sollte nie ankommen (UI verhindert vorab, §8) | `PAYLOAD_TOO_LARGE` | Banner als Fallback |

- `<ErrorNotice error={apiError} onRetry?>` ist die EINZIGE
  Fehlerdarstellung im Projekt — keine ad-hoc-`alert()`s, keine
  verstreuten Fehlertexte.
- **Loading:** Jede 🐢-View rendert ihr Layout sofort und füllt die
  Datenkacheln mit `<Skeleton>`-Platzhaltern (Tailwind `animate-pulse`,
  eine wiederverwendete Komponente). Buttons nutzen `isPending` zum
  Deaktivieren mit Inline-Spinner. Kein globaler Ladebalken.

**Trade-offs:** Pro-Code-Spezialbehandlung (eigene Dialoge je Fehler)
wäre feiner, aber 19 Codes × Views = Pflegelast ohne Mehrwert, weil die
`detail`-Texte bereits kontextspezifisch formuliert sind.

---

## 4. Datenfluss: Wo lebt "das aktuelle Portfolio"?

**Empfehlung:** Zwei klar getrennte Quellen, beide OHNE neue Konzepte:

- **(learn)-Bereich:** Das Portfolio ist ABGELEITET, nie eigener State.
  `usePortfolioWeights()` nimmt die (gecachte) `paper/valuation`-Antwort
  und liefert `{ticker: market_value}` — beliebige Skala ist per
  `PortfolioIn`-Vertrag erlaubt, die API renormalisiert. Ampel-, Stress-
  und Simulations-Queries hängen via TanStack-`enabled` an der
  Valuation-Query (dependent query). Ein Trade → Depot ändert sich →
  Valuation-Invalidierung → alle abhängigen Views aktualisieren sich —
  genau der Kern-Loop aus ARCHITECTURE §1, ohne einen einzigen
  manuell synchronisierten Zustand.
- **analyze-Bereich:** Eigener localStorage-Slot (`analyze_portfolio`,
  letzte manuelle Eingabe bzw. letztes CSV-Ergebnis) mit eigenem kleinen
  Hook. Bewusst getrennt vom Depot: "Was wäre wenn"-Portfolios dürfen
  das Lern-Depot nicht verfälschen.

**Kein URL-State** (Gewichts-Dicts in Query-Params sind unleserlich,
kollidieren mit den 50-Ticker-Limits und bringen Encoding-Probleme),
**kein Prop-Drilling** über Seitengrenzen (App-Router-Seiten teilen
Props nicht), **kein globaler Portfolio-Store** (das Depot IST schon die
Quelle der Wahrheit, ein zweiter Store wäre Redundanz).

---

## 5. Typsicherheit: `lib/types.ts` manuell (wie geplant)

**Empfehlung:** Manuell pflegen, ein TS-Interface pro Contract-Schema,
gegliedert nach Domänen, **jeder Typ mit Kommentar-Verweis auf seinen
API_CONTRACT-Paragrafen** und JSDoc für die Zahlen-Konventionen
(Dezimalbrüche, Faktoren ab 1.0, negative VaR — §1.2/§1.3).

**Begründung:** 13 Endpunkte × stabile, frisch entschiedene Schemas =
~200 Zeilen einmaliger Aufwand. OpenAPI-Codegen (openapi-typescript)
brächte jetzt Toolchain-Komplexität (Spec-Export, Generierungs-Schritt,
CI-Verdrahtung, generierte Typen lesen lernen) für ein Solo-Projekt, in
dem nur EIN Konsument existiert. ARCHITECTURE §6 sieht Codegen ohnehin
als "später ggf." vor.

**Definierter Wechsel-Trigger:** Sobald Phase 2 Schemas ändert ODER ein
zweiter API-Konsument entsteht (native App, Phase 3), wird auf Codegen
umgestellt — vorher nicht.

**Trade-off:** Manuell kann driften. Gegenmittel: die §-Kommentare
machen Abgleich mechanisch, und der Playwright-Smoke-Test (§9) fängt
grobe Vertragsbrüche.

---

## 6. Charting: Recharts bestätigt — mit konkretem Fächer-Rezept

**Prüfergebnis:** Recharts (v2/v3) kann beide anspruchsvollen Charts.
Der entscheidende, wenig bekannte Baustein: eine `<Area>` rendert ein
**Band**, wenn der Datenwert ein Zwei-Element-Array `[low, high]` ist.

**Rezept Monte-Carlo-Fächer** (aus `MonteCarloOut`, §2.11):

```tsx
"use client";  // Recharts ist client-only — Pflicht im App Router!

// 1. Parallele Arrays → Zeilenobjekte, Band als [low, high] VORAB
//    berechnen (nicht als dataKey-Funktion — robuster über Versionen):
const rows = out.trading_days.map((day, i) => ({
  day,
  band: [out.p10[i], out.p90[i]] as [number, number],
  p50: out.p50[i],
}));

// 2. Chart: Band-Fläche + Median-Linie. Feste Höhe am Container ist
//    Pflicht, sonst rendert ResponsiveContainer 0 Pixel.
<div className="h-72">
  <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={rows}>
      <XAxis
        dataKey="day"
        tickFormatter={(d) => `${Math.round(d / 252)} J`}  // Handelstage → Jahre
      />
      <YAxis tickFormatter={(v) => `${Math.round(v * 100)} %`} />
      <Tooltip
        formatter={(v) => /* Faktor deutsch, z.B. "×1,85" */}
        labelFormatter={(d) => /* "nach X Monaten" via d/21 */}
      />
      <Area dataKey="band" stroke="none" fillOpacity={0.2}
            isAnimationActive={false} />
      <Line dataKey="p50" dot={false} strokeWidth={2}
            isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>
</div>
```

Beschriftung im Umfeld des Charts (nicht im Chart selbst): die
Frequenz-Formulierung aus `explanation` + der `disclaimer` — beide
kommen fertig vom Backend (MONTE_CARLO_DECISIONS §5), das Frontend
erfindet keine eigenen Prognose-Texte.

**Stress-Replay-Kurve:** simples `LineChart` über `dates`/`value_path`
(~370 Punkte, unkritisch), X-Achse mit `minTickGap` ausdünnen, Y-Achse
als Prozent vom Start (Faktor − 1). Drawdown-Punkt optional per
`ReferenceDot` markieren.

**Gotchas fürs Bauen:** (a) jede Chart-Komponente braucht
`"use client"`; (b) `recharts` ist im Frontend noch NICHT installiert —
`npm i recharts` gehört zum ersten Bau-Schritt; (c) Animationen aus
(`isAnimationActive={false}`), sonst "zappelt" der deterministische
Fächer bei jedem Rerender — er soll ruhig wirken, nicht wie ein Orakel.

**Trade-offs:** visx/d3 wären mächtiger (echte Konfidenz-Gradienten),
aber mit steiler Lernkurve; Chart.js bräuchte ein React-Wrapper-Paket.
Recharts deckt alles Benötigte deklarativ ab.

---

## 7. Routing & Seitenstruktur

```
frontend/app/
├── page.tsx                  # Landing: Kern-Loop in 3 Sätzen, Disclaimer,
│                             #   CTA "Paper-Depot starten" → /depot
├── (learn)/                  # Route-Group: gemeinsames Layout
│   ├── layout.tsx            # Navigation (Depot·Ampel·Stress·Simulation),
│   │                         #   DepotProvider, fester Disclaimer-Footer
│   ├── depot/page.tsx        # Positionen, Cash, P&L; Trade-Dialog
│   │                         #   (quote-Vorschau → execute)
│   ├── ampel/page.tsx        # 3 Ampeln + Lernkarten + Score-Kachel
│   ├── stress/page.tsx       # Preset-Auswahl (GET /stress/presets) → Replay
│   └── simulation/page.tsx   # Horizont-Wahl (1/5/10) → Perzentil-Fächer
└── analyze/page.tsx          # freies Portfolio: manuelle Eingabe ODER
                              #   CSV-Upload → Analyse + Optimizer (mit
                              #   Pflicht-Disclaimer aus OptimizeOut)
```

**User-Story "von null zum ersten Trade" (ARCHITECTURE §1) als Fluss:**

1. Landing erklärt den Loop → CTA legt beim Klick das Depot an
   (10 000 € Startcash) und führt zu `/depot`.
2. `/depot` im Leer-Zustand zeigt keinen leeren Tisch, sondern eine
   geführte Karte: "Dein erster Trade" mit vorausgefülltem Trade-Dialog.
3. Nach dem ersten erfolgreichen Trade erscheint eine Hinweis-Karte
   "Was bedeutet das für dein Risiko? → Zur Ampel".
4. Die Ampel-View verlinkt weiter zu Stress ("Wie hätte sich dein Depot
   2008 geschlagen?") und Simulation ("Wohin könnte es laufen?").

**Leer-Zustände sind Pflicht-Deliverables** jeder View (Depot ohne
Trades, Ampel/Stress/Simulation ohne Positionen → freundlicher Verweis
zurück zum Depot), ebenso der feste Disclaimer im (learn)-Layout
(Prinzip 3: "fest in der UI", ARCHITECTURE §1).

**Trade-offs:** `/analyze` außerhalb der Route-Group hält den
Lern-Bereich fokussiert; dafür braucht analyze eine eigene minimale
Navigation. Onboarding als eigene Route (`/onboarding`) wäre
Overengineering — die Landing übernimmt das.

---

## 8. Sicherheits-Grenzen im UI vorab abfangen

**Empfehlung:** `lib/limits.ts` als **kommentierter Spiegel** von
`backend/src/sentinel_api/limits.py` (Kommentar in beiden Dateien
verweist auf das jeweilige Gegenstück — wer eine Seite ändert, ändert
beide):

| Grenze | UI-Maßnahme VOR dem Request |
|---|---|
| 50 Ticker/Portfolio | Positionszähler "12 von 50" im Depot & analyze; Kauf-Dialog/Hinzufügen-Feld deaktiviert am Limit, mit Hinweistext |
| Ticker-Format | Input mit `maxLength={15}`, Uppercase-Transform beim Tippen, Regex-Check `^[A-Z0-9.\-^=]{1,15}$` vor dem Absenden (Fehlermeldung inline, identischer Wortlaut-Stil wie das Backend) |
| 1 MB CSV | `<input accept=".csv">` + `file.size`-Check vor dem Upload ("Datei ist X MB groß, maximal 1 MB") |
| 2 MB Body / 413 | durch die beiden obigen Checks praktisch unerreichbar; bleibt reiner `<ErrorNotice>`-Fallback |
| 10 000 Transaktionen | defensiver Check in `usePaperDepot` mit Warnhinweis ab 9 500 — praktisch unerreichbar, aber der Zustand darf nie kommentarlos kaputtgehen |

**Begründung:** Ein Limit, das der Nutzer erst nach einem fehlge-
schlagenen Request erfährt, fühlt sich wie ein Bug an; dasselbe Limit
als sichtbarer Zähler ist schlicht eine Produkteigenschaft. Die
Server-Grenzen bleiben die eigentliche Verteidigung (das UI ist
umgehbar) — die UI-Checks sind reine UX.

---

## Bau-Reihenfolge für die nächste Session

1. `npm i @tanstack/react-query recharts` · `lib/types.ts` +
   `lib/api.ts` + `lib/limits.ts` (Fundament, ohne UI testbar).
2. `lib/depot-storage.ts` + `usePaperDepot` + `DepotProvider`.
3. `/depot` inkl. Trade-Dialog und Leer-Zustand (Kern-Loop-Anfang).
4. `/ampel` (erste 🐢-View: etabliert Skeleton/ErrorNotice-Muster).
5. `/stress` + `/simulation` (Charts nach §6-Rezept).
6. `/analyze` (Eingabe, CSV-Upload mit §8-Checks, Optimizer).
7. Landing + Flusskarten + Playwright-Smoke-Test (ARCHITECTURE §9:
   Trade ausführen → Ampel ändert sich).

Jeder Schritt endet mit `npm run build` grün; UI-Texte deutsch,
Code/Kommentare englisch (CLAUDE.md).
