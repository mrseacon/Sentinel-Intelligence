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
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PortfolioIn } from "@/lib/types";

/** `PortfolioIn.weights` erlaubt eine beliebige Skala (§1.5, die API
 * renormalisiert serverseitig) — für die Anzeige "Aktuell"-Spalte neben
 * den Modell-Prozenten brauchen wir dieselbe Normierung hier lokal. */
function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((sum, v) => sum + v, 0);
  if (total <= 0) return weights;
  return Object.fromEntries(
    Object.entries(weights).map(([ticker, value]) => [ticker, value / total]),
  );
}

export function OptimizeSection({ portfolio }: { portfolio: PortfolioIn }) {
  const { dict, locale } = useI18n();
  const tickers = Object.keys(portfolio.weights);
  const [requested, setRequested] = useState(false);

  const query = useQuery({
    queryKey: ["portfolio", "optimize", [...tickers].sort()],
    queryFn: () => postPortfolioOptimize({ tickers }),
    enabled: requested,
  });

  if (tickers.length < 2) {
    return <p className="text-sm text-muted">{dict.analyze.optimize.needsTwoPositions}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {!requested && (
        <button
          type="button"
          onClick={() => setRequested(true)}
          className="w-fit rounded-md border border-border px-4 py-1.5 text-sm font-medium text-soft transition-colors hover:border-border-strong hover:text-ink"
        >
          {dict.analyze.optimize.cta}
        </button>
      )}

      {requested && query.error instanceof ApiError && (
        <ErrorNotice error={query.error} onRetry={() => query.refetch()} />
      )}

      {requested && !(query.error instanceof ApiError) && (query.isPending || !query.data) && (
        <Skeleton className="h-40 w-full" />
      )}

      {query.data && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label={dict.analyze.optimize.expectedReturn}
              value={`${(query.data.expected_return * 100).toFixed(1)} %`}
            />
            <StatTile
              label={dict.analyze.optimize.volatility}
              value={`${(query.data.volatility * 100).toFixed(1)} %`}
            />
            <StatTile
              label={dict.analyze.optimize.sharpeRatio}
              value={query.data.sharpe.toFixed(2)}
            />
          </div>

          <WeightsTable
            currentWeights={normalizeWeights(portfolio.weights)}
            modelWeights={query.data.weights}
          />

          {/* I18N_DECISIONS.md §5: disclaimer bleibt unübersetzt vom
              Backend (Phase-2-Frage), Prinzip 3 verlangt trotzdem
              IMMER sichtbar, nicht aufklappbar. */}
          {locale !== "de" && (
            <p className="text-xs text-faint italic">{dict.analyze.optimize.germanOnlyNotice}</p>
          )}
          <p className="text-xs text-faint">{query.data.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function WeightsTable({
  currentWeights,
  modelWeights,
}: {
  currentWeights: Record<string, number>;
  modelWeights: Record<string, number>;
}) {
  const { dict } = useI18n();
  const tickers = Object.keys(modelWeights).sort(
    (a, b) => modelWeights[b] - modelWeights[a],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] tracking-[0.08em] text-faint uppercase">
        {dict.analyze.optimize.suggestedWeights}
      </p>
      <div className="grid grid-cols-[1fr_78px_78px] gap-2.5 text-[11px] tracking-[0.07em] text-faint uppercase">
        <span>{dict.analyze.optimize.positionCol}</span>
        <span className="text-right">{dict.analyze.optimize.currentCol}</span>
        <span className="text-right">{dict.analyze.optimize.modelCol}</span>
      </div>
      {tickers.map((ticker) => (
        <div
          key={ticker}
          className="grid grid-cols-[1fr_78px_78px] items-center gap-2.5 border-b border-border pb-2"
        >
          <span className="font-mono text-xs tracking-[0.04em]">{ticker}</span>
          <span className="text-right font-mono text-xs text-soft">
            {currentWeights[ticker] !== undefined
              ? `${Math.round(currentWeights[ticker] * 100)} %`
              : "–"}
          </span>
          <span className="text-right font-mono text-xs">
            {Math.round(modelWeights[ticker] * 100)} %
          </span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-mono text-lg">{value}</p>
    </div>
  );
}
