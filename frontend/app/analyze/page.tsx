import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analyse" };

// Bewusst außerhalb der (learn)-Route-Group (FRONTEND_DECISIONS.md §7):
// freie "Was wäre wenn"-Portfolios sollen das Lern-Depot nicht berühren,
// daher eigene, minimale Navigation statt der Depot/Ampel/Stress-Leiste.
export default function AnalyzePage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Link
        href="/"
        className="text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        ← Zur Startseite
      </Link>
      <section className="mt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Freie Portfolio-Analyse</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Hier entstehen manuelle Eingabe, CSV-Upload sowie Analyse und
          Optimizer in der nächsten Bau-Phase.
        </p>
      </section>
    </div>
  );
}
