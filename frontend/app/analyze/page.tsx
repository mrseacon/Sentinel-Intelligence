import Link from "next/link";
import type { Metadata } from "next";

import { AnalyzeView } from "./AnalyzeView";

export const metadata: Metadata = { title: "Analyse" };

// Bewusst außerhalb der (learn)-Route-Group (FRONTEND_DECISIONS.md §7):
// freie "Was wäre wenn"-Portfolios sollen das Lern-Depot nicht berühren,
// daher eigene, minimale Navigation statt der Depot/Ampel/Stress-Leiste.
// Server-Komponente wegen `metadata`, Logik lebt in AnalyzeView (Client).
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
        <AnalyzeView />
      </section>
    </div>
  );
}
