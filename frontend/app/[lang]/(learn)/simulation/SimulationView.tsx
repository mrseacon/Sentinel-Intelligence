"use client";

// Client-Teil der Simulation-Seite (page.tsx bleibt Server-Komponente
// wegen `metadata`), gleiches Muster wie StressView/AmpelView. Das
// Portfolio kommt ausschließlich aus den Depot-Positionen
// (FRONTEND_DECISIONS §4). Horizont-Auswahl -> dependent Query auf
// POST /simulation/monte-carlo (FRONTEND_DECISIONS §1: POST-als-Query).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, postSimulationMonteCarlo } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { formatDecimal } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LocaleLink } from "@/lib/i18n/link";
import { canonicalWeights, derivePortfolioWeights } from "@/lib/portfolio";
import type { Dictionary } from "@/lib/i18n/dictionaries/de";
import type { MonteCarloOut, PositionValueOut } from "@/lib/types";

// Handelstage/Jahr, identisch zu sentinel_core/constants.py TRADING_DAYS.
// Hier nur zur Umrechnung der `trading_days`-Offsets in Achsenbeschriftungen.
const TRADING_DAYS_PER_YEAR = 252;
const TRADING_DAYS_PER_MONTH = 21;

const HORIZONS = [1, 5, 10] as const;
type Horizon = (typeof HORIZONS)[number];

export function SimulationView() {
  const { depot, valuation, isValuationLoading, valuationError } =
    useDepot();
  const { dict } = useI18n();

  // Depot noch nicht aus localStorage gelesen (usePaperDepot §2-SSR-Gotcha).
  if (depot === null) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{dict.simulation.title}</h1>
        <p className="text-slate-600 dark:text-slate-300">
          {dict.simulation.subtitle}
        </p>
      </div>

      <SimulationContent
        hasTransactions={depot.transactions.length > 0}
        isValuationLoading={isValuationLoading}
        valuationError={valuationError}
        positions={valuation?.positions}
      />
    </section>
  );
}

function SimulationContent({
  hasTransactions,
  isValuationLoading,
  valuationError,
  positions,
}: {
  hasTransactions: boolean;
  isValuationLoading: boolean;
  valuationError: ApiError | null;
  positions: PositionValueOut[] | undefined;
}) {
  if (!hasTransactions) {
    return <EmptyHint />;
  }

  if (valuationError) {
    return <ErrorNotice error={valuationError} />;
  }

  if (isValuationLoading || positions === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (positions.length === 0) {
    return <EmptyHint />;
  }

  return <SimulationResult positions={positions} />;
}

function EmptyHint() {
  const { dict } = useI18n();

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">{dict.simulation.emptyTitle}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {dict.simulation.emptyBody}
      </p>
      <LocaleLink
        href="/depot"
        className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        {dict.common.goToDepot}
      </LocaleLink>
    </div>
  );
}

function SimulationResult({ positions }: { positions: PositionValueOut[] }) {
  const { dict } = useI18n();
  const weights = derivePortfolioWeights(positions);
  const [selectedHorizon, setSelectedHorizon] = useState<Horizon | null>(
    null,
  );

  const simQuery = useQuery({
    queryKey: [
      "simulation",
      "monte-carlo",
      canonicalWeights(weights),
      selectedHorizon,
    ],
    queryFn: () =>
      postSimulationMonteCarlo({
        portfolio: { weights },
        horizon_years: selectedHorizon!,
      }),
    enabled: selectedHorizon !== null,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {HORIZONS.map((horizon) => (
          <button
            key={horizon}
            type="button"
            onClick={() => setSelectedHorizon(horizon)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              selectedHorizon === horizon
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            }`}
          >
            {horizon === 1
              ? dict.simulation.horizon1Year
              : dict.simulation.horizonYears(horizon)}
          </button>
        ))}
      </div>

      {selectedHorizon !== null && (
        <SimulationChart
          query={simQuery}
          horizon={selectedHorizon}
          onRetry={() => simQuery.refetch()}
        />
      )}
    </div>
  );
}

function SimulationChart({
  query,
  horizon,
  onRetry,
}: {
  query: ReturnType<typeof useQuery<MonteCarloOut>>;
  horizon: Horizon;
  onRetry: () => void;
}) {
  const { dict, locale } = useI18n();

  if (query.error instanceof ApiError) {
    return <ErrorNotice error={query.error} onRetry={onRetry} />;
  }

  if (query.isPending || !query.data) {
    return <Skeleton className="h-72 w-full" />;
  }

  const result = query.data;

  const rows = result.trading_days.map((day, i) => ({
    day,
    band: [result.p10[i], result.p90[i]] as [number, number],
    p50: result.p50[i],
  }));

  const fmt = (value: number) => `×${formatDecimal(value, locale)}`;

  return (
    <div className="space-y-4">
      {/* I18N_DECISIONS.md §5: explanation/lesson/disclaimer bleiben
          unübersetzt vom Backend (Phase-2-Frage). */}
      {locale !== "de" && (
        <p className="text-xs text-slate-500 italic dark:text-slate-400">
          {dict.simulation.germanOnlyNotice}
        </p>
      )}

      {/* Frequenz-Formulierung 1:1 vom Backend übernommen (MONTE_CARLO_
          DECISIONS §5): das Frontend formuliert keine eigene
          Wahrscheinlichkeitsaussage. */}
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {result.explanation}
      </p>

      {result.thin_history && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>{dict.simulation.thinHistoryLabel}</strong>{" "}
          {dict.simulation.thinHistoryBody(
            formatDecimal(result.history_years, locale, 1),
            result.limiting_ticker
              ? dict.simulation.limitedBy(result.limiting_ticker)
              : "",
            formatDecimal(result.recycling_factor, locale, 1),
          )}
        </div>
      )}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <XAxis
              dataKey="day"
              tickFormatter={(day: number) => formatAxisTick(day, horizon, dict)}
              minTickGap={40}
            />
            <YAxis tickFormatter={(v: number) => fmt(v)} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value, name) => {
                if (name === "band") {
                  const [low, high] = value as unknown as [number, number];
                  return [`${fmt(low)} – ${fmt(high)}`, dict.simulation.bandTooltip];
                }
                return [fmt(Number(value)), dict.simulation.medianTooltip];
              }}
              labelFormatter={(day) =>
                formatTooltipLabel(Number(day), horizon, dict)
              }
            />
            <Area
              dataKey="band"
              stroke="none"
              fill="#0f172a"
              fillOpacity={0.15}
              isAnimationActive={false}
            />
            <Line
              dataKey="p50"
              dot={false}
              strokeWidth={2}
              stroke="#0f172a"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={dict.simulation.stats.p10} value={fmt(result.final_p10)} />
        <StatCard label={dict.simulation.stats.p50} value={fmt(result.final_p50)} />
        <StatCard label={dict.simulation.stats.p90} value={fmt(result.final_p90)} />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
          {dict.common.whatDoesThisMean}
        </summary>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {result.lesson}
        </p>
      </details>

      {/* Fester Disclaimer, absichtlich NICHT aufklappbar (Prinzip 3 /
          Designprinzip 1): muss immer sichtbar sein. */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {result.disclaimer}
      </p>
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

/** Handelstag-Offset -> Achsenbeschriftung: Monate bei 1 Jahr Horizont,
 * sonst Jahre (rohe Handelstag-Zahlen wären für Laien nicht lesbar). */
function formatAxisTick(day: number, horizon: Horizon, dict: Dictionary): string {
  if (horizon === 1) {
    return `${Math.round(day / TRADING_DAYS_PER_MONTH)} ${dict.simulation.axisMonths}`;
  }
  return `${Math.round(day / TRADING_DAYS_PER_YEAR)} ${dict.simulation.axisYears}`;
}

function formatTooltipLabel(day: number, horizon: Horizon, dict: Dictionary): string {
  if (horizon === 1) {
    const months = Math.round(day / TRADING_DAYS_PER_MONTH);
    return dict.simulation.afterMonth(months);
  }
  const years = Math.round(day / TRADING_DAYS_PER_YEAR);
  return dict.simulation.afterYear(years);
}
