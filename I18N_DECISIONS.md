# Internationalisierung (i18n) – Architektur-Entscheidungen

Status: **Freigegeben am 2026-08-03** – Diese Runde entscheidet und
implementiert **Fragen 1, 3, 4, 6 sowie die Scope-Abgrenzung aus Frage 5**
(UI-Chrome-Übersetzung + Routing-Infrastruktur). **Frage 2** (Backend-Locale
für wertgefüllte Erklärtexte) ist eine **bewusst vertagte Phase-2-
Entscheidung**: Richtung und Begründung sind hier dokumentiert, **NICHT**
umgesetzt. Der Backend-Code (`sentinel_core`, `sentinel_api`) bleibt in
dieser Runde vollständig unangetastet.

Feature: Englische Sprachversion des Frontends, als erster Schritt Richtung
öffentlich nutzbares Produkt (ARCHITECTURE.md §1: "perspektivisch
B2C-Business").
Referenzen: CLAUDE.md (Nutzer ist Frontend-Neuling – bei Gleichwertigkeit
gewinnt die geringere Lernkurve), ARCHITECTURE.md §1/§3, API_CONTRACT.md
§1.1/§1.4, FRONTEND_DECISIONS.md §2/§3/§5.

Nach Freigabe werden die Entscheidungen in FRONTEND_DECISIONS.md verlinkt
(neue Sektion "i18n"); die vertagte Frage 2 wandert als offener Punkt nach
ARCHITECTURE.md §10.

---

## 0. Vorbemerkung: Woher kommen die Texte? (Bestandsaufnahme)

Beim Durchgehen von CLAUDE.md, ARCHITECTURE.md, API_CONTRACT.md §1.4 sowie
`education/explanations.py` und `errors.py` ergeben sich drei klar
getrennte Text-Kategorien:

1. **Reine Frontend-UI-Texte** – Navigation (`Nav.tsx`), Landing-Page
   (`app/page.tsx`, ~470 Zeilen statischer Marketing-Text), fester
   Disclaimer (`Disclaimer.tsx`), Buttons, Leer-Zustände, Skeleton-ARIA-
   Labels, Meta-Beschreibungen. Liegen komplett im Frontend, enthalten
   keine Zahlen, keine Backend-Abhängigkeit. **→ Exakt der Scope dieser
   Runde.**
2. **Backend-generierte, wertgefüllte Erklärtexte** – die Felder
   `explanation`/`lesson`/`disclaimer` aus `RiskAmpelOut`,
   `StressReplayOut`, `MonteCarloOut`, `BenchmarkCompareOut`. Kommen aus
   `education/explanations.py`: fertige deutsche Sätze mit eingebetteter
   Fachlogik – Status-Verzweigung (grün/gelb/rot), bedingte Zusatzsätze
   (Top-3-Klausel bei Konzentration, Ausschluss-Hinweis bei Stress,
   Dünn-Historie-Warnung bei Simulation), Pluralregeln ("Position" vs.
   "Positionen"), grammatisches Geschlecht bei Präset-Titeln ("Im
   Szenario „X“" statt "In der/dem X"), deutsche Zahlenformate (Komma
   statt Punkt, "%"-Abstand). Ein Regressionstest (`test_ampel.py`,
   `FORBIDDEN_ACTION_STEMS`) erzwingt zusätzlich Prinzip 3
   (keine Anlageberatung) auf genau diesen Text. **→ Diese Runde:
   unangetastet; Richtung für Phase 2 in Frage 2 dokumentiert.**
3. **Core-Fehlermeldungen** – deutsche `ValueError`-Texte aus
   `sentinel_core`, laufen unverändert als `detail` durch das
   `{detail, code}`-Schema (API_CONTRACT §1.1, `errors.py`-Registry). Der
   Wortlaut ist über exakte Teilstring-Matches in Tests fixiert (z. B.
   `test_risk_metrics.py`, `test_correlation.py`). **→ Diese Runde:
   Übersetzung ausschließlich über eine Frontend-seitige `code`→Text-
   Tabelle, Backend unangetastet (Frage 3).**

Eine wichtige Zwischenkategorie fällt beim genauen Hinsehen aus Kategorie 2
heraus: `AmpelOut.title`, `ScenarioPresetOut.title` und
`BenchmarkOptionOut.title` kommen zwar vom Backend, sind aber **stabile
Enum-Label** zu einer bereits vorhandenen, maschinenlesbaren `id`
(API_CONTRACT §1.4: "`id`... maschinenlesbares Englisch"), keine
Freitext-Sätze mit Zahlen. Sie werden in dieser Runde wie Kategorie 1
behandelt (Details in Frage 5).

---

## 1. i18n-Bibliothek fürs Frontend

**Empfehlung: Eigene Dictionary-Lösung nach dem offiziellen Next.js-
App-Router-Muster (`app/[lang]/dictionaries.ts` + Objekte pro Sprache),
kein next-intl. Keine neue Dependency für die Übersetzungsschicht selbst.**

Bevor diese Empfehlung feststand, wurde geprüft, was die **tatsächlich
installierte** Next.js-Version (16.2.10 – AGENTS.md warnt ausdrücklich vor
Abweichungen von Trainingsdaten) selbst dokumentiert:
`node_modules/next/dist/docs/01-app/02-guides/internationalization.md`
beschreibt für den App Router genau dieses Muster – ein `[lang]`-Segment,
JSON/TS-"Dictionaries" pro Sprache, eine `getDictionary(lang)`-Funktion –
als **den** Standardweg. next-intl wird dort nur als eine von acht
optionalen Community-Bibliotheken für weitergehende Bedürfnisse (ICU-
Pluralformen, reiche Formatierung) verlinkt, nicht vorausgesetzt.

**Konkrete Bau-Skizze:**

```
frontend/
├── proxy.ts                      # Locale-Erkennung + Redirect (Frage 4/6)
├── lib/i18n/
│   ├── config.ts                 # LOCALES = ["de","en"] as const, DEFAULT_LOCALE = "de"
│   ├── dictionaries/
│   │   ├── de.ts
│   │   └── en.ts
│   ├── get-dictionary.ts         # async getDictionary(locale) – server-only
│   ├── link.tsx                  # LocaleLink: next/link-Wrapper mit [lang]-Präfix
│   └── labels.ts                 # id -> englisches Label (Ampel/Presets/Benchmarks, Frage 5)
└── app/
    └── [lang]/
        ├── layout.tsx            # <html lang={lang}>, Providers
        ├── page.tsx              # Landing
        ├── (learn)/...
        └── analyze/...
```

- Server-Komponenten lesen das Dictionary direkt über `params.lang`
  (Next 16: async `params`, `PageProps`/`LayoutProps`-Helper).
- Client-Komponenten (z. B. `Nav.tsx`, das wegen `usePathname` bereits
  `"use client"` ist) bekommen Locale + Dictionary über einen dünnen
  `I18nProvider`, initialisiert im `(learn)/layout.tsx` (Server-
  Komponente) – **exakt dasselbe, bereits etablierte Muster wie
  `DepotProvider`** (FRONTEND_DECISIONS §2). Kein neues Konzept für den
  Nutzer.

**Begründung:**

- CLAUDE.md-Regel greift direkt: "bei Gleichwertigkeit gewinnt die
  geringere Lernkurve." Für zwei Sprachen ohne komplexe ICU-Pluralregeln
  (die einzigen Pluralfälle heute – "Position"/"Positionen" in
  `AmpelView.tsx` – werden schon per einfachem Ternary gelöst) ist
  next-intl technisch nicht überlegen, bringt aber ein zusätzliches
  API-Konzept mit (Provider, `useTranslations`, Message-Namespaces,
  Routing-Plugin in `next.config.ts`, eigene Config-Datei).
- Keine neue Dependency für die Übersetzungsschicht selbst (CLAUDE.md:
  "keine neuen Dependencies ohne kurze Begründung").
- Next.js dokumentiert das Muster selbst für **diese** Version – kein
  Risiko, eine Community-Library zu wählen, die mit einer zukünftigen
  Breaking-Change-Runde kollidiert (die "not the Next.js you know"-Warnung
  in AGENTS.md gilt für Drittanbieter-Integrationen genauso wie fürs
  Kern-Framework).

**Trade-offs:**

- next-intl liefert von Haus aus einen lokalisierten `Link`/`useRouter`-
  Wrapper, ICU-MessageFormat (verschachtelte Pluralformen, reiche
  Formatierung), generierte Typsicherheit über Message-Keys und eine
  größere Docs-/Community-Basis für später wachsende Anforderungen.
- Die Eigenlösung muss den Link-Wrapper selbst schreiben
  (`lib/i18n/link.tsx`, überschaubar) – sonst verlieren interne Links
  (`Link href="/depot"` in `Nav.tsx`, `AmpelView.tsx`, `StressView.tsx`,
  `DepotView.tsx` u. a.) beim Navigieren das aktuelle Locale-Präfix. Das
  ist die einzige echte Lücke gegenüber next-intl – sie wird als
  expliziter Bauschritt behandelt (s. Bau-Skizze am Ende), nicht
  übersehen.
- **Wechsel-Trigger** (wie FRONTEND_DECISIONS §5): Kommt eine dritte
  Sprache mit echten ICU-Pluralregeln (Polnisch, Russisch, Arabisch, …)
  oder wächst der Textumfang so, dass Typsicherheit über Message-Keys
  spürbar fehlt, wird next-intl neu bewertet – vorher nicht.

---

## 2. Wertgefüllte Erklärtexte (Backend) – Phase-2-Entscheidung, diese Runde vertagt

**Diese Runde:** `education/explanations.py`, alle Response-Schemas und
`errors.py` bleiben unverändert. Jeder Endpunkt liefert weiterhin
ausschließlich Deutsch, unabhängig von der im Frontend gewählten
UI-Sprache. Die konkrete Übergangs-UX dafür steht in Frage 5.

**Empfehlung für die Umsetzung, sobald Phase 2 ansteht: Weg (a) – Backend
bekommt einen `locale`-Parameter als optionales Feld an den betroffenen
`*In`-Schemas (`RiskAmpelIn`, `StressReplayIn`, `MonteCarloIn`,
`BenchmarkCompareIn`), `explanations.py` hält DE- **und** EN-Templates als
eine Quelle der Wahrheit.**

```python
# Skizze, NICHT Teil dieser Runde:
class RiskAmpelIn(BaseModel):
    portfolio: PortfolioIn
    period: Period = "1y"
    locale: Literal["de", "en"] = "de"   # neues Feld, wie period bereits heute
```

Body-Feld statt `Accept-Language`-Header, weil das dem bestehenden
API-Stil entspricht: jedes `*In`-Schema trägt seine Optionen bereits
explizit als Feld (`period` existiert überall schon so) – ein Header wäre
ein neues, implizites Konvention-Konzept neben dem etablierten
"alles Relevante steht im Body" (API_CONTRACT §1.5). Der `Accept-Language`-
Header bliebe die HTTP-idiomatischere Wahl und würde sich clientseitig
"automatisch" mit dem Wert aus Frage 6 füllen lassen – als Trade-off
dokumentiert, nicht gewählt.

**Begründung für Weg (a) gegenüber Weg (b) (Frontend dupliziert die
Erklärlogik in Englisch):**

Der Blick in `explanations.py` (§0) zeigt, dass die Erklärtexte **keine
simplen String-Templates** sind, sondern selbst Fachlogik enthalten:
Status-Schwellen-Verzweigung, bedingte Zusatzklauseln, Plural- und
Genus-Sonderfälle, deutsche Zahlenformatierung – und das alles unter
einem bestehenden, Prinzip-3-kritischen Compliance-Test
(`test_ampel.py`). Weg (b) würde diese gesamte Verzweigungslogik **plus**
den Compliance-Test ein zweites Mal, unabhängig, in TypeScript
nachbauen müssen. Jede künftige Änderung (neue Schwelle, neue Formulierung,
neuer Status-Zweig) müsste dann an zwei Stellen synchron gepflegt werden –
mit dem Risiko, dass eine Sprache eine Prinzip-3-Verletzung (versehentliche
Kauf-/Verkaufsformulierung) enthält, die die andere nicht hat. Das ist
genau der stille Drift, den CLAUDE.md an anderer Stelle für Score-Anker
und Schwellen explizit ausschließt ("Keine stillen Änderungen an
Score-Ankern, Gewichten oder Ampel-Schwellen") – dieselbe Sorgfaltspflicht
gilt für die Texte, die diese Schwellen erklären.

Weg (a) ist der größere Eingriff in ein fertiges, getestetes Modul, aber
ein **einmaliger** Aufwand (zwei Template-Sätze pro Funktion,
`test_ampel.py` läuft für beide Sprachen), während Weg (b) ein
**wiederkehrender** Pflegeaufwand mit Compliance-Risiko wäre.

**Trade-offs von Weg (a):**

- Berührt ein Modul, das CLAUDE.md explizit als "fertig, getestet" markiert
  – jede Änderung dort verdient denselben Sorgfaltsgrad wie beim
  Erstbau (Spalten-Shuffle-Analogie: bestehende Tests dürfen nicht
  aufgeweicht werden, nur um Platz für Englisch zu schaffen).
- Verdoppelt near-verbatim die Zeilenzahl in `explanations.py`
  (jede Funktion bekommt einen Sprachzweig) – Alternative wäre externe
  Message-Kataloge (z. B. `gettext`/`.po`-Dateien) statt Python-f-Strings,
  aber das wäre für zwei Sprachen und die vorhandene Verzweigungslogik
  ein Werkzeugwechsel ohne echten Mehrwert; f-String-Templates mit einem
  Sprachzweig bleiben einfacher zu lesen und zu testen.

---

## 3. Core-Fehlermeldungen

**Empfehlung: Eine Frontend-Mapping-Tabelle `code → englischer Text` reicht
aus – aber nur zusammen mit (a) einem Vollständigkeits-Test und (b) einem
generischen Fallback-Text für unbekannte Codes.**

```ts
// frontend/lib/i18n/error-messages.en.ts
export const ERROR_MESSAGES_EN: Record<string, string> = {
  TICKER_NOT_FOUND: "Ticker symbol not found.",
  PORTFOLIO_INVALID: "This portfolio is not valid.",
  PAPER_INSUFFICIENT_CASH: "Not enough cash for this purchase.",
  // … alle Codes aus API_CONTRACT.md §1.1
  DOMAIN_ERROR: "Something went wrong. Please try again.", // Fallback-Code selbst
};

export function englishErrorMessage(code: string): string {
  return ERROR_MESSAGES_EN[code] ?? ERROR_MESSAGES_EN.DOMAIN_ERROR;
}
```

- **Vollständigkeits-Test:** analog zum bereits akzeptierten manuellen
  Sync-Prinzip von `lib/types.ts` (FRONTEND_DECISIONS §5: "Codegen erst ab
  einem zweiten API-Konsumenten oder Phase-2-Schemaänderung"). Ein
  Frontend-Test hält die vollständige Code-Liste aus API_CONTRACT.md §1.1
  als literales Array und prüft `Object.keys(ERROR_MESSAGES_EN)` exakt
  dagegen. Sobald ein neuer Code in der `errors.py`-Registry auftaucht
  (wie zuletzt `CORRELATION_INVALID_INPUT`), muss diese Liste UND der
  Contract-Eintrag zusammen aktualisiert werden – der Test schlägt fehl,
  bis beides passiert ist.
- **Fallback:** `DOMAIN_ERROR` ist bereits der Backend-seitige
  Fallback-Code für unbekannte Fehler (`FALLBACK_CODE` in `errors.py`) –
  die Frontend-Tabelle spiegelt das 1:1: jeder unbekannte/neue Code fällt
  auf denselben generischen englischen Text zurück. Das deutsche `detail`
  selbst wird **nicht** als Fallback angezeigt – eine Sprachmischung im
  Fehlerfall wäre schlechter als ein generischer, aber durchgängig
  englischer Text.
- Die bestehende Kategorisierung aus FRONTEND_DECISIONS §3 (Banner vs.
  inline, `RETRYABLE_CODES`) bleibt unverändert – nur der angezeigte Text
  wird pro Sprache ausgetauscht, das Verhalten (`ErrorNotice`-Variante,
  Retry-Button) hängt weiterhin ausschließlich am `code`.

**Antwort auf die Lücken-Frage:** Ja, ausreichend – aber nur mit dem
Vollständigkeitstest. Ohne ihn entsteht bei jedem neuen Backend-Feature
eine stille Lücke, die erst durch einen QA-Bug auffällt statt durch eine
failende Testsuite.

**Trade-offs:** Eine automatisierte Cross-Repo-Prüfung (Backend exportiert
die Registry z. B. als JSON-Fixture, Frontend-Test liest sie ein) wäre
robuster gegen Drift als zwei unabhängig gepflegte Listen, bräuchte aber
einen Export-/Build-Mechanismus, den es heute nicht gibt – für aktuell
~19 Codes Overengineering. Wechsel-Trigger: signifikant wachsende
Code-Liste oder häufige neue Codes.

---

## 4. Sprachumschalter / Routing

**Empfehlung: Pfad-Präfix (`/de/...`, `/en/...`) über ein `[lang]`-
Dynamic-Segment, Locale-Erkennung/Redirect in `proxy.ts`, manuelle
Umschaltung wird per Cookie dauerhaft gemerkt.**

Wichtiger Versions-Fund beim Prüfen der installierten Next.js-Doku: Die
Datei heißt in Next.js 16 **`proxy.ts`, nicht `middleware.ts`** – die
Middleware-Datei-Konvention wurde in v16.0.0 umbenannt (Funktion
`middleware()` → `proxy()`, Grund laut Next.js-Doku: Verwechslungsgefahr
mit Express-Middleware). Ein Codemod existiert
(`npx @next/codemod@canary middleware-to-proxy .`), falls Tutorials oder
Bibliotheken noch den alten Namen verwenden – genau die Art
Trainingsdaten-Falle, vor der AGENTS.md warnt.

**Warum Pfad-Präfix statt Cookie-only oder Query-Parameter:**

- **SEO/Crawling:** Jede Sprachversion ist eine eigene, crawlbare,
  indexierbare URL. Ein reiner Cookie-Schalter zeigt Suchmaschinen und
  nicht-JS-Clients immer dieselbe (Default-)Sprache – für die
  Showcase-/B2C-Ambition (ARCHITECTURE §1, README nennt eine Live-Demo)
  ein echter Nachteil.
- **Sharing:** Ein Link wie `sentinel.app/en/ampel` zeigt beim Teilen
  zuverlässig die englische Version. Bei Cookie-basiertem Umschalten sieht
  ein Empfänger ohne den Cookie die Default-Sprache, unabhängig davon, was
  der Absender gerade sah – widerspricht der Erwartung "ich teile genau
  das, was ich sehe."
- **Query-Parameter** (`?lang=en`) hätte dieselben Sharing-Vorteile, aber
  keine kanonische URL pro Sprache (Duplicate-Content-Risiko ohne
  sorgfältige `hreflang`/`canonical`-Tags) und fällt bei internen Links
  leicht weg – dasselbe Link-Wrapper-Problem wie in Frage 1, nur
  fehleranfälliger, weil ein Query-Parameter typografisch leichter
  vergessen wird als ein Pfad-Segment.

**Skizze `proxy.ts`:**

```ts
// frontend/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return;

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    (cookieLocale && LOCALES.includes(cookieLocale as (typeof LOCALES)[number])
      ? cookieLocale
      : undefined) ?? detectFromAcceptLanguage(request) ?? DEFAULT_LOCALE;

  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

function detectFromAcceptLanguage(request: NextRequest): string | undefined {
  const negotiator = new Negotiator({
    headers: { "accept-language": request.headers.get("accept-language") ?? "" },
  });
  try {
    return match(negotiator.languages(), LOCALES, DEFAULT_LOCALE);
  } catch {
    return undefined;
  }
}

export const config = {
  // Assets/Metadaten aussparen, sonst blockiert der Redirect CSS/JS/Bilder
  matcher: ["/((?!_next|api|favicon.ico|manifest.webmanifest).*)"],
};
```

Neue Dependencies dafür: `@formatjs/intl-localematcher` + `negotiator`
(+ `@types/negotiator`) – genau die Bibliotheken, die Next.js' eigene
Doku für Accept-Language-Parsing vorschlägt. Begründung für die Ausnahme
von "keine neuen Dependencies ohne Begründung": Parsing von
HTTP-Language-Tags mit Quality-Values ist eine Standardaufgabe mit
Randfällen (Wildcards, Quality-Werte, Groß-/Kleinschreibung) – kein Grund
für Eigenbau-Code, den man dann selbst pflegen und testen müsste.

**Trade-offs:**

- Domain-basiertes Routing (`en.sentinel.app`) wäre SEO-technisch
  gleichwertig, aber für ein Solo-Projekt ohne bestehende
  Subdomain-Infrastruktur (DNS, Zertifikate, Hosting-Konfiguration)
  unnötiger Aufwand – abgelehnt.
- Reines Cookie/localStorage ohne Pfad wäre der geringste
  Implementierungsaufwand (kein `[lang]`-Umzug der gesamten
  `app/`-Struktur nötig), verliert aber SEO/Sharing komplett – für ein
  Projekt mit explizitem Showcase-/Business-Anspruch nicht akzeptabel.
- Der `[lang]`-Umzug ist der größte strukturelle Eingriff dieser Runde:
  jede bestehende Route (`(learn)/*`, `analyze/*`, `page.tsx`) wandert
  eine Ebene tiefer unter `app/[lang]/`. Kein Weg drumherum bei
  Pfad-Präfix-Routing – als einmaliger, expliziter Schritt in der
  Bau-Skizze eingeplant, nicht nebenbei.

---

## 5. Scope dieser Runde vs. spätere Phasen

**Diese Runde (wird jetzt umgesetzt):**

- Routing-Infrastruktur: `[lang]`-Segment-Umzug, `proxy.ts`,
  Cookie-Persistenz, Erstbesuch-Erkennung (Frage 4/6).
- UI-Chrome komplett Englisch: Navigation (`Nav.tsx`), Landing-Page
  (`app/page.tsx`), fester Disclaimer (`Disclaimer.tsx`),
  Buttons/Leer-Zustände/Skeleton-ARIA-Labels, Seiten-Überschriften,
  Fehlercode-Mapping (Frage 3), die Sprachumschalter-UI selbst,
  `<html lang>` und Meta-Description pro Sprache.
- **Lernkarten-/Ergebnis-Überschriften** (Ampel-Titel wie
  "Klumpenrisiko", Stress-Preset-Titel wie "Finanzkrise 2008/09",
  Benchmark-Titel wie "MSCI World (URTH)"): siehe Abgrenzung unten – **in
  dieser Runde übersetzt**, obwohl sie vom Backend kommen.

**Wichtige Abgrenzung – Titel vs. Freitext:** `AmpelOut.title`,
`ScenarioPresetOut.title` und `BenchmarkOptionOut.title` kommen zwar aus
API-Responses, sind aber stabile Enum-Label zu einer bereits vorhandenen,
maschinenlesbaren `id` (3 Ampel-IDs, 3 Presets, 2 Benchmarks – eine
kleine, selten wachsende Menge). Sie werden über eine kleine Frontend-
Lookup-Tabelle `id → englisches Label` übersetzt (`lib/i18n/labels.ts`)
– genau wie die Fehlercodes in Frage 3, **ohne** auf die
Phase-2-Backend-Erweiterung zu warten. Kein Drift-Risiko, weil `id`
bereits das stabile, vertraglich fixierte Element ist (API_CONTRACT §1.4),
nicht Freitext mit eingebetteten Zahlen.

**Bewusst NICHT diese Runde (Phase 2, Richtung in Frage 2 dokumentiert):**

- Freitext-Erklärkörper: die interpolierten `explanation`- und
  `lesson`-Sätze aus `explanations.py`, sowie die drei backend-seitigen
  `disclaimer`-Konstanten (Stress/Simulation/Optimizer). Bleiben auf
  englischsprachigen Seiten weiterhin Deutsch.
- **Übergangs-UX für diesen Freitext:** ein einzelner, chrome-seitiger
  Hinweistext pro betroffener Seite statt eines Hinweises pro Karte –
  z. B. auf `/en/ampel`: *"Detailed explanations below are currently
  German-only; an English version is planned for a later update."*
  Weniger repetitiv als ein Hinweis pro Ampel-/Preset-Karte, ein einziger
  neuer Chrome-String pro betroffener Seite (Ampel, Stress, Simulation,
  Benchmark-Vergleich). Kennzeichnet den Zustand ehrlich, statt wie ein
  Bug zu wirken.
- **Impressum/Datenschutzerklärung** (sobald vorhanden): bewusst
  **dauerhaft** nur Deutsch – deutsches Recht, eine Eins-zu-eins-
  Übersetzung wäre rechtlich unpräzise und für ein Solo-Projekt kein
  sinnvoller Aufwand. Üblich, dass auch international ausgerichtete
  deutsche Seiten ihr Impressum nur auf Deutsch führen. Kein
  Wechsel-Trigger vorgesehen – das bleibt so.
- Code, Kommentare, Commits, interne Docs: bereits Englisch (CLAUDE.md:
  "Englisch in Code, Kommentaren, Commits und Docs") – keine i18n-Aufgabe,
  bleibt unberührt.

**Begründung für den Schnitt:** Routing-Infrastruktur + UI-Chrome ist in
einer Session umsetzbar und bereits allein ein vollständiger, sichtbarer
Nutzwert ("die App lässt sich auf Englisch bedienen"). Die Freitext-
Erklärungen sind der aufwendigste **und** heikelste Teil (Prinzip-3-
Compliance, grammatische Sonderfälle, Formulierungs-Drift-Risiko, s.
Frage 2) – sie in derselben Runde mitzuziehen hätte den Umfang mindestens
verdoppelt und das Risiko einer unfertigen, halb übersetzten Erklärschicht
mit sich gebracht (CLAUDE.md: "Keine Platzhalter-Module... keine
halbfertigen Implementierungen"). Ein sauberer Schnitt mit einer explizit
gekennzeichneten Übergangs-UX ist besser als eine versteckte
Inkonsistenz.

**Trade-off:** Die App bleibt für diese Runde sprachlich gemischt auf drei
Detail-Seiten (Ampel/Stress/Simulation/Benchmark-Vergleich). Das ist eine
bewusste, zeitlich befristete Zwischenlösung, kein Endzustand – muss im
PR-/Commit-Text explizit als "Teil 1 von 2" gekennzeichnet werden, damit es
nicht als vergessen missverstanden wird.

---

## 6. Default-Sprache & Erkennung

**Empfehlung: Deutsch bleibt Fallback (`DEFAULT_LOCALE = "de"`), Browser-
Spracherkennung (`Accept-Language`) nur beim allerersten Besuch ohne
Locale-Cookie; jede manuelle Umschaltung setzt einen langlebigen Cookie,
der ab dann immer Vorrang vor Accept-Language hat.**

**Begründung:**

- Deutsch als Fallback (nicht Englisch) spiegelt die tatsächliche
  Kernzielgruppe wider (ARCHITECTURE §1: Betrieb aus Deutschland, deutsche
  Lerninhalte, deutsche Rechtstexte) – ein englischer Default würde bei
  jedem direkten Besuch ohne Sprachsignal (Lesezeichen, direkt getippte
  URL) an der eigentlichen Zielgruppe vorbeigehen.
- Automatische Erstbesuchs-Erkennung ist trotzdem sinnvoll: Für die
  Showcase-Ambition (Recruiter, internationales Publikum) zeigt ein
  Browser mit `Accept-Language: en-US` beim ersten Klick direkt Englisch,
  ohne dass jemand erst manuell umschalten muss – genau das von Next.js'
  eigener Doku vorgeschlagene Muster (Frage 4).
- Cookie-Vorrang nach manueller Wahl verhindert das häufigste
  i18n-Ärgernis: Ein Nutzer schaltet bewusst um, ein Reload/erneuter
  Besuch wirft ihn zurück auf die Browser-Sprache.

**Trade-offs:**

- Reine serverseitige Erkennung ohne Cookie (jedes Mal neu aus
  Accept-Language) wäre einfacher, respektiert aber keine bewusste
  Nutzerentscheidung dauerhaft – abgelehnt.
- `localStorage` statt Cookie würde clientseitig funktionieren, aber
  `proxy.ts` läuft serverseitig **vor** dem ersten Render und kann
  `localStorage` nicht lesen – für Pfad-Präfix-Routing ist ein Cookie
  (im Request verfügbar) die einzig praktikable Option, kein echter
  Nachteil.

---

## Konkrete Bau-Skizze für diese Runde

1. `npm i @formatjs/intl-localematcher negotiator` + `npm i -D
   @types/negotiator` – einzige neuen Dependencies (Frage 4).
2. `lib/i18n/config.ts` (`LOCALES`, `DEFAULT_LOCALE`, `LOCALE_COOKIE`),
   `proxy.ts` (Erkennung + Redirect, Frage 4/6).
3. `app/[lang]/`-Umzug: bestehende `page.tsx`, `(learn)/*`, `analyze/*`
   eine Ebene tiefer verschieben; `generateStaticParams` im Root-
   `[lang]/layout.tsx` (`[{lang: "de"}, {lang: "en"}]`); `<html lang={lang}>`
   dynamisch statt hartkodiert `"de"` (bisher `app/layout.tsx:39`).
4. `lib/i18n/dictionaries/{de,en}.ts` + `get-dictionary.ts`;
   `lib/i18n/link.tsx` (Locale-Link-Wrapper) – jeder bestehende
   `next/link`-Import (`Nav.tsx`, `AmpelView.tsx`, `StressView.tsx`,
   `DepotView.tsx`, Landing-Page u. a.) wird darauf umgestellt
   (mechanischer, aber vollständigkeitskritischer Schritt, Frage 1).
5. `lib/i18n/labels.ts` – die `id`→Label-Tabelle für Ampel-/Preset-/
   Benchmark-Titel (Frage 5).
6. `lib/i18n/error-messages.en.ts` + Vollständigkeitstest (Frage 3).
7. Sprachumschalter-Komponente im `(learn)/layout.tsx`-Header (neben
   `Nav`) und im Landing-Layout.
8. Übergangs-Hinweistext für Freitext-Erklärungen (Frage 5) auf den vier
   betroffenen Views (Ampel, Stress, Simulation, Benchmark-Vergleich).
9. `npm run build` + visueller Check in beiden Sprachen **und** beiden
   Farbmodi (bestehende Konvention, s. zuletzt Korrelationsmatrix-Feature).

---

## Übergreifende Leitplanken (nicht verhandelbar)

1. **Backend bleibt in dieser Runde unverändert** – kein Endpunkt, kein
   Schema, kein Test in `backend/` wird angefasst.
2. **Prinzip 3 (keine Anlageberatung)** gilt für jeden neuen englischen
   Chrome-Text genauso wie für die deutschen Originale – insbesondere
   Landing-Page-Übersetzungen und der Übergangs-Hinweistext aus Frage 5.
3. **Graceful Degradation:** Fällt die Locale-Erkennung aus (fehlender/
   fehlerhafter `Accept-Language`-Header, `match()`-Exception), ist
   Deutsch der Fallback – nie ein Absturz, nie eine leere Seite.
4. **Kein stiller Übersetzungs-Drift:** Jede neue deutsche UI-Chrome-
   Zeichenkette braucht ab sofort ihren englischen Dictionary-Eintrag im
   selben PR (Analogie zur bestehenden Regel "keine stillen Änderungen an
   Score-Ankern, Gewichten oder Ampel-Schwellen").

---

## Offene Punkte / Wechsel-Trigger für Phase 2

- **Backend-Locale-Erweiterung** für `explanations.py` (Frage 2):
  Richtung entschieden (Weg a, Body-Feld `locale`), Umsetzung vertagt bis
  diese Runde validiert ist.
- Sobald eine dritte Sprache mit echten ICU-Pluralregeln ansteht oder
  next-intl aus anderen Gründen doch gebraucht wird: Frage 1 neu bewerten.
- Impressum/Datenschutzerklärung: bleibt dauerhaft nur Deutsch – kein
  Wechsel-Trigger vorgesehen (bewusste Dauerentscheidung, Frage 5).
