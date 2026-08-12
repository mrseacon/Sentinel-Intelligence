"use client";

// Orchestriert den analyze-Bereich: Portfolio kommt aus Upload ODER
// manueller Eingabe (PortfolioBuilder), danach Analyse + Optimierung.
// Bewusst kein Bezug zum Paper-Depot (ARCHITECTURE §1: "Was wäre wenn"-
// Portfolios dürfen das Lern-Depot nicht verfälschen, FRONTEND_DECISIONS
// §4). Die independentNote lebt jetzt im Seitenkopf (AnalyzePageChrome).
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
    <div className="flex flex-col gap-6">
      <PortfolioBuilder onPortfolioReady={setPortfolio} />

      {portfolio && (
        <>
          <section className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
            <h2 className="mb-4 text-[15px] font-semibold">
              {dict.analyze.sectionAnalyze}
            </h2>
            <AnalyzeResult portfolio={portfolio} />
          </section>

          <section className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
            <h2 className="mb-4 text-[15px] font-semibold">
              {dict.analyze.sectionBenchmark}
            </h2>
            <BenchmarkCompare portfolio={portfolio} />
          </section>

          <section className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
            <h2 className="mb-4 text-[15px] font-semibold">
              {dict.analyze.sectionOptimize}
            </h2>
            <OptimizeSection portfolio={portfolio} />
          </section>
        </>
      )}
    </div>
  );
}
