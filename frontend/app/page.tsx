import Link from "next/link";

import { Disclaimer } from "@/components/Disclaimer";
import { HeroDemo } from "@/components/HeroDemo";

// Reine Server-Komponente bis auf HeroDemo (Client, simulierter Slider
// ohne Backend-Anbindung). Struktur/Texte/visuelles Konzept aus
// docs/design/Sentinel Landing.dc.html übernommen, aber als Tailwind-
// Komponente mit den bestehenden Projekt-Konventionen umgesetzt (siehe
// Depot/Ampel/Stress-Views) statt der Inline-Styles aus dem Export.
// Farben/Schwellen der Ampel-Beispiele: s. Kommentar in HeroDemo.tsx.
// Das Anlegen des Depots passiert erst im Ziel (/depot).

const STEPS = [
  {
    number: "01",
    title: "Depot eröffnen, mit Spielgeld",
    body: "Du startest mit 10.000 € virtuellem Kapital. Kein Account, keine Einzahlung, kein Risiko.",
  },
  {
    number: "02",
    title: "Zu echten Kursen kaufen und verkaufen",
    body: "Die Marktdaten sind real, aber bis zu 15 Minuten verzögert. Positionen und Historie bleiben jederzeit nachvollziehbar.",
  },
  {
    number: "03",
    title: "Risiko-Ampel lesen",
    body: "Drei Ampeln beschreiben dein Depot in Worten: Klumpenrisiko, Diversifikation und Volatilität. Nie als Kaufempfehlung.",
  },
  {
    number: "04",
    title: "Gegen Krisen und Zukünfte prüfen",
    body: "Der Stress-Test rechnet mit echten Krisenzeiträumen. Die Monte-Carlo-Simulation zeigt die Bandbreite möglicher Verläufe.",
  },
];

const AMPEL_EXAMPLES = [
  {
    title: "Diversifikation",
    icon: "✓",
    label: "Grün",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    border: "border-l-emerald-500",
    text: "Dein Kapital ist auf mehrere Branchen verteilt. Ein schwacher Sektor trifft dich damit nicht mit voller Wucht.",
    lesson:
      "Was heißt das? Diversifikation ist keine Garantie gegen Verluste. Sie sorgt dafür, dass nicht alles gleichzeitig fällt.",
  },
  {
    title: "Klumpenrisiko",
    icon: "!",
    label: "Gelb",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    border: "border-l-amber-500",
    text: "Deine größte Position wiegt 38 Prozent. Das Depot folgt damit vor allem einem einzigen Unternehmen.",
    lesson:
      "Was heißt das? Konzentration verstärkt beide Richtungen, Gewinn und Verlust. Entscheidend ist, dass du sie bewusst wählst.",
  },
  {
    title: "Volatilität",
    icon: "✕",
    label: "Rot",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    border: "border-l-red-500",
    text: "Die Kurse deiner Positionen schwankten historisch stark. Wertänderungen von mehreren Prozent am Tag sind hier normal.",
    lesson:
      "Was heißt das? Volatilität misst Schwankung, nicht Qualität. Die Frage ist, ob du sie aushältst, ohne panisch zu verkaufen.",
  },
];

const CRISIS_EXAMPLES = [
  {
    title: "Finanzkrise",
    range: "Okt 2007 bis Mär 2009",
    depth: 82,
    text: "Ein langer, zäher Rückgang über 17 Monate. Die Krise, die Geduld am stärksten testet.",
  },
  {
    title: "Corona-Crash",
    range: "Feb bis Mär 2020",
    depth: 58,
    text: "Ein sehr schneller Einbruch in wenigen Wochen, gefolgt von einer ebenso schnellen Erholung.",
  },
  {
    title: "Zinswende",
    range: "Jan bis Okt 2022",
    depth: 44,
    text: "Ein breiter Rückgang, bei dem auch klassische Absicherungen wenig geholfen haben.",
  },
];

const METHOD_CARDS = [
  {
    title: "Echte Marktdaten, verzögert",
    body: "Kurse und Renditen stammen aus echten historischen Marktdaten. Sie sind bis zu 15 Minuten verzögert.",
  },
  {
    title: "Nachvollziehbare Formeln",
    body: "Die Kennzahlen basieren auf Gewichtung, Korrelation und Standardabweichung. Jede Regel ist offen dokumentiert.",
  },
  {
    title: "Keine Empfehlungen",
    body: "Sentinel beschreibt Portfolioeigenschaften. Es sagt dir nie, welches Wertpapier du kaufen oder verkaufen sollst.",
  },
  {
    title: "Kein echtes Geld",
    body: "Alle Trades sind virtuell. Es gibt kein Konto, keine Order an eine Börse und keine Gebühren.",
  },
];

const navLinkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";

const ctaClass =
  "inline-flex items-center justify-center rounded-full bg-slate-900 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

const eyebrowClass =
  "font-mono text-[11px] tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded border border-slate-400 dark:border-slate-500">
              <span className="h-1.5 w-1.5 rounded-[1px] bg-slate-400 dark:bg-slate-500" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Sentinel
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <a href="#wie" className={navLinkClass}>
              Wie es funktioniert
            </a>
            <Link href="/ampel" className={navLinkClass}>
              Risiko-Ampel
            </Link>
            <Link href="/stress" className={navLinkClass}>
              Krisen-Vergleich
            </Link>
            <a href="#methodik" className={navLinkClass}>
              Methodik
            </a>
            <Link
              href="/depot"
              className="ml-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Kostenlos starten
            </Link>
          </nav>
          <Link
            href="/depot"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white sm:hidden dark:bg-slate-100 dark:text-slate-900"
          >
            Starten
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section
          id="hero"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-28">
            <span className={eyebrowClass}>
              Jede Kennzahl kommt mit einer Erklärung
            </span>
            <h1 className="max-w-[22ch] text-center text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Verstehen statt raten.
            </h1>
            <p className="max-w-[58ch] text-center text-lg leading-relaxed text-pretty text-slate-600 sm:text-xl dark:text-slate-300">
              Sentinel zeigt dir nicht nur eine Risikozahl, sondern erklärt in
              einem Satz, woher sie kommt: welche Position zu schwer wiegt,
              wo Diversifikation fehlt, wie stark deine Kurse historisch
              geschwankt sind.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link href="/depot" className={ctaClass}>
                Kostenlos starten
              </Link>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Mit virtuellem Kapital. Keine Anmeldung nötig.
              </span>
            </div>
            <HeroDemo />
          </div>
        </section>

        <section
          id="wie"
          className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>Wie es funktioniert</span>
            <h2 className="max-w-[26ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              In vier Schritten vom ersten Trade zum verstandenen Depot
            </h2>
            <p className="max-w-[56ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Kein Kurs und kein Video. Du lernst am eigenen Depot, und jede
              Auswertung erklärt sich selbst.
            </p>
            <ol className="w-full max-w-2xl divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {STEPS.map((step) => (
                <li
                  key={step.number}
                  className="grid grid-cols-[52px_1fr] gap-5 py-5"
                >
                  <span className="font-mono text-sm text-slate-400 dark:text-slate-500">
                    {step.number}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="ampel"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>Risiko-Ampel</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Drei Fragen, die dein Depot beantworten muss
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Der Status steht nie nur in einer Farbe. Es gibt immer ein
              Zeichen, ein Wort und eine Erklärung, was daraus folgt.
            </p>
            <div className="grid w-full gap-4 text-left sm:grid-cols-3">
              {AMPEL_EXAMPLES.map((ampel) => (
                <div
                  key={ampel.title}
                  className={`space-y-3 rounded-lg border border-slate-200 border-l-4 p-5 dark:border-slate-800 ${ampel.border}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{ampel.title}</h3>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ampel.badge}`}
                    >
                      <span aria-hidden="true">{ampel.icon}</span>
                      {ampel.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {ampel.text}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ampel.lesson}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="krisen"
          className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>Historischer Vergleich</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Wie hätte sich dein Depot 2008 geschlagen?
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Sentinel legt dein aktuelles Portfolio über drei tatsächliche
              Krisenzeiträume und rechnet mit den echten Tagesrenditen dieser
              Monate. Kein Szenario ist eine Prognose. Es ist eine
              Erinnerung daran, wie tief Märkte fallen können.
            </p>
            <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
              {CRISIS_EXAMPLES.map((crisis) => (
                <div
                  key={crisis.title}
                  className="space-y-3.5 rounded-lg border border-slate-200 p-5 dark:border-slate-800"
                >
                  <div className="space-y-0.5">
                    <span className="block text-sm font-semibold">
                      {crisis.title}
                    </span>
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                      {crisis.range}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                      style={{ width: `${crisis.depth}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {crisis.text}
                  </p>
                </div>
              ))}
            </div>
            <p className="max-w-[60ch] text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Die Balken zeigen die relative Tiefe und Dauer der jeweiligen
              Phase. Vergangene Wertentwicklung sagt nichts über die Zukunft.
              Der Vergleich dient dazu, deine eigene Verlusttoleranz
              einzuschätzen, bevor echtes Geld im Spiel ist.
            </p>
          </div>
        </section>

        <section
          id="simulation"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>Zukunftssimulation</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Eine Bandbreite, keine Prognose
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Die Monte-Carlo-Simulation zieht tausende Pfade aus echten
              historischen Tagesrenditen deiner Positionen. Das Ergebnis ist
              ein Korridor: wie gut es laufen könnte, wie schlecht, und wie
              breit die Unsicherheit dazwischen ist.
            </p>
            <div className="grid w-full max-w-3xl gap-8 rounded-xl border border-slate-200 p-6 text-left sm:grid-cols-[1.35fr_1fr] sm:items-center dark:border-slate-800">
              <div className="space-y-3">
                <div className="relative h-48 overflow-hidden border-b border-l border-slate-200 dark:border-slate-800">
                  <div
                    className="absolute inset-x-0 top-[12%] bottom-[12%] bg-gradient-to-r from-slate-200/20 to-slate-400/60 dark:from-slate-700/20 dark:to-slate-500/50"
                    style={{
                      clipPath: "polygon(0 46%, 100% 0, 100% 100%, 0 54%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 top-[26%] bottom-[26%] bg-gradient-to-r from-slate-300/30 to-slate-500/70 dark:from-slate-600/30 dark:to-slate-400/60"
                    style={{
                      clipPath: "polygon(0 46%, 100% 12%, 100% 88%, 0 54%)",
                    }}
                  />
                  <div className="absolute inset-x-0 top-1/2 h-px origin-left -rotate-6 bg-slate-400 dark:bg-slate-500" />
                </div>
                <div className="flex justify-between font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  <span>heute</span>
                  <span>1 Jahr</span>
                  <span>5 Jahre</span>
                  <span>10 Jahre</span>
                </div>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                <div className="space-y-1 pb-4">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    Oberes Fünftel
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Deutlich über dem Einsatz. Der Fall, den man sich gern
                    merkt.
                  </p>
                </div>
                <div className="space-y-1 py-4">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    Mittlerer Pfad
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Der Verlauf, an dem du deine Erwartung ausrichten
                    solltest.
                  </p>
                </div>
                <div className="space-y-1 pt-4">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    Unteres Fünftel
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Der Fall, den du aushalten musst, ohne die Strategie zu
                    verwerfen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="methodik"
          className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>Methodik und Grenzen</span>
            <h2 className="max-w-[26ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Was Sentinel rechnet und was es nicht kann
            </h2>
            <p className="max-w-[60ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Sentinel beschreibt Portfolioeigenschaften wie Klumpenrisiko,
              Diversifikation und Volatilität auf Basis vergangener Kurse.
              Das ist keine Anlageberatung und keine Empfehlung für einzelne
              Wertpapiere.
            </p>
            <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2">
              {METHOD_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="space-y-2 rounded-lg border border-slate-200 p-5 dark:border-slate-800"
                >
                  <h3 className="text-sm font-semibold">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="start"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>Jetzt üben</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem]">
              Der erste Fehler sollte dich nichts kosten.
            </h2>
            <p className="max-w-[54ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Starte mit virtuellem Kapital, beobachte dein Risiko und
              entscheide später mit echtem Geld. Dann aber informiert.
            </p>
            <Link href="/depot" className={ctaClass}>
              Kostenlos starten
            </Link>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Keine Anmeldung, keine Zahlungsdaten, kein echtes Geld.
            </span>
          </div>
        </section>
      </main>

      <footer>
        <Disclaimer />
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-5 px-6 pb-10 text-sm">
          <a
            href="#methodik"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Methodik
          </a>
          <a
            href="#wie"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Wie es funktioniert
          </a>
          <Link
            href="/depot"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Kostenlos starten
          </Link>
        </div>
      </footer>
    </div>
  );
}
