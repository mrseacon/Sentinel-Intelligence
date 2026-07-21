"use client";

// POST /portfolio/optimize nimmt nur Ticker, keine Gewichte entgegen
// (Contract-Entscheidung: der Optimizer bestimmt die Gewichtung selbst).
// Ausgelöst per Button statt automatisch, da es fachlich ein bewusst
// angefragtes "was wäre optimal" ist, kein abgeleiteter Wert wie bei
// Ampel/Stress/Simulation.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, postPortfolioOptimize } from "@/lib/api";
import type { PortfolioIn } from "@/lib/types";

export function OptimizeSection({ portfolio }: { portfolio: PortfolioIn }) {
  const tickers = Object.keys(portfolio.weights);
  const [requested, setRequested] = useState(false);

  const query = useQuery({
    queryKey: ["portfolio", "optimize", [...tickers].sort()],
    queryFn: () => postPortfolioOptimize({ tickers }),
    enabled: requested,
  });

  if (tickers.length < 2) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Die Optimierung braucht mindestens 2 Positionen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!requested && (
        <button
          type="button"
          onClick={() => setRequested(true)}
          className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Portfolio optimieren
        </button>
      )}

      {requested && query.error instanceof ApiError && (
        <ErrorNotice error={query.error} onRetry={() => query.refetch()} />
      )}

      {requested && !(query.error instanceof ApiError) && (query.isPending || !query.data) && (
        <Skeleton className="h-40 w-full" />
      )}

      {query.data && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Erwartete Rendite (p.a.)"
              value={`${(query.data.expected_return * 100).toFixed(1)} %`}
            />
            <StatCard
              label="Volatilität (p.a.)"
              value={`${(query.data.volatility * 100).toFixed(1)} %`}
            />
            <StatCard label="Sharpe Ratio" value={query.data.sharpe.toFixed(2)} />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Vorgeschlagene Gewichtung
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {Object.entries(query.data.weights)
                .sort(([, a], [, b]) => b - a)
                .map(([ticker, weight]) => (
                  <li
                    key={ticker}
                    className="flex justify-between text-slate-700 dark:text-slate-200"
                  >
                    <span>{ticker}</span>
                    <span>{Math.round(weight * 100)} %</span>
                  </li>
                ))}
            </ul>
          </div>

          {/* Pflichtfeld (Prinzip 3): IMMER sichtbar, nicht aufklappbar. */}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {query.data.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
