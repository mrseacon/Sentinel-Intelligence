"use client";

// Orchestriert den analyze-Bereich: Portfolio kommt aus Upload ODER
// manueller Eingabe (PortfolioBuilder), danach Analyse + Optimierung.
// Bewusst kein Bezug zum Paper-Depot (ARCHITECTURE §1: "Was wäre wenn"-
// Portfolios dürfen das Lern-Depot nicht verfälschen, FRONTEND_DECISIONS
// §4).
import { useState } from "react";

import type { PortfolioIn } from "@/lib/types";

import { AnalyzeResult } from "./AnalyzeResult";
import { OptimizeSection } from "./OptimizeSection";
import { PortfolioBuilder } from "./PortfolioBuilder";

export function AnalyzeView() {
  const [portfolio, setPortfolio] = useState<PortfolioIn | null>(null);

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        Dies ist eine unabhängige Analyse, kein Bezug zu deinem Paper-Depot.
      </p>

      <PortfolioBuilder onPortfolioReady={setPortfolio} />

      {portfolio && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Analyse</h2>
            <AnalyzeResult portfolio={portfolio} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Optimieren</h2>
            <OptimizeSection portfolio={portfolio} />
          </section>
        </>
      )}
    </div>
  );
}
