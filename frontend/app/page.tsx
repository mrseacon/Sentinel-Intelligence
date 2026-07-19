import Link from "next/link";

// Reine Server-Komponente: keine Interaktivität nötig, das Anlegen des
// Depots passiert erst im Ziel (/depot) — siehe Bau-Reihenfolge Schritt 2/3
// in FRONTEND_DECISIONS.md.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="max-w-xl space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Verstehe dein Risiko, bevor du echtes Geld investierst
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Baue ein Paper-Depot mit 10.000&nbsp;€ Spielgeld auf. Die
          Risiko-Ampel zeigt dir Klumpenrisiko, Diversifikation und
          Volatilität — verständlich erklärt, nie als Kaufempfehlung.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kurse sind bis zu 15 Minuten verzögert. Sentinel ersetzt keine
          Anlageberatung.
        </p>
        <Link
          href="/depot"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Paper-Depot starten
        </Link>
      </div>
    </main>
  );
}
