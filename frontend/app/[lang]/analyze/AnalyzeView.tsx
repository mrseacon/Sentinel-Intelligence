"use client";

// Orchestriert den analyze-Bereich: Portfolio kommt aus Upload ODER
// manueller Eingabe (PortfolioBuilder), danach Analyse + Optimierung.
// Bewusst kein Bezug zum Paper-Depot (ARCHITECTURE §1: "Was wäre wenn"-
// Portfolios dürfen das Lern-Depot nicht verfälschen, FRONTEND_DECISIONS
// §4).
import { useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PortfolioIn } from "@/lib/types";

import { AnalyzeResult } from "./AnalyzeResult";
import { BenchmarkCompare } from "./BenchmarkCompare";
import { OptimizeSection } from "./OptimizeSection";
import { PortfolioBuilder } from "./PortfolioBuilder";

export function AnalyzeView() {
  const { dict } = useI18n();
  const [portfolio, setPortfolio] = useState<PortfolioIn | null>(null);

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {dict.analyze.independentNote}
      </p>

      <PortfolioBuilder onPortfolioReady={setPortfolio} />

      {portfolio && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{dict.analyze.sectionAnalyze}</h2>
            <AnalyzeResult portfolio={portfolio} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{dict.analyze.sectionBenchmark}</h2>
            <BenchmarkCompare portfolio={portfolio} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{dict.analyze.sectionOptimize}</h2>
            <OptimizeSection portfolio={portfolio} />
          </section>
        </>
      )}
    </div>
  );
}
