"use client";

// Client-Teil der Simulation-Seite (page.tsx bleibt Server-Komponente
// wegen `metadata`), gleiches Muster wie StressView/AmpelView. Das
// Portfolio kommt ausschließlich aus den Depot-Positionen
// (FRONTEND_DECISIONS §4). Horizont-Auswahl -> dependent Query auf
// POST /simulation/monte-carlo (FRONTEND_DECISIONS §1: POST-als-Query).
import Link from "next/link";
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
import { canonicalWeights, derivePortfolioWeights } from "@/lib/portfolio";
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
        <h1 className="text-2xl font-semibold">Zukunftssimulation</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Wohin könnte sich dein heutiges Depot entwickeln? Wähle einen
          Zeithorizont.
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
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Noch keine Positionen</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Die Simulation braucht ein Depot mit mindestens einer Position.
        Starte auf der Depot-Seite mit deinem ersten Trade.
      </p>
      <Link
        href="/depot"
        className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Zum Depot
      </Link>
    </div>
  );
}

function SimulationResult({ positions }: { positions: PositionValueOut[] }) {
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
            {horizon === 1 ? "1 Jahr" : `${horizon} Jahre`}
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

  return (
    <div className="space-y-4">
      {/* Frequenz-Formulierung 1:1 vom Backend übernommen (MONTE_CARLO_
          DECISIONS §5): das Frontend formuliert keine eigene
          Wahrscheinlichkeitsaussage. */}
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {result.explanation}
      </p>

      {result.thin_history && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Dünne Datenbasis:</strong> Nur{" "}
          {formatNum1(result.history_years)} Jahre Kurshistorie
          {result.limiting_ticker
            ? ` (begrenzt durch ${result.limiting_ticker})`
            : ""}{" "}
          verfügbar. Sie wird rechnerisch rund{" "}
          {formatNum1(result.recycling_factor)}-mal wiederverwendet: Seltene
          Ereignisse wie Crashs fehlen darin womöglich vollständig.
        </div>
      )}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <XAxis
              dataKey="day"
              tickFormatter={(day: number) => formatAxisTick(day, horizon)}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: number) => `×${formatNum1(v)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "band") {
                  const [low, high] = value as unknown as [number, number];
                  return [`×${formatNum1(low)} bis ×${formatNum1(high)}`, "80 % der Verläufe"];
                }
                return [`×${formatNum1(Number(value))}`, "mittlerer Verlauf"];
              }}
              labelFormatter={(day) => formatTooltipLabel(Number(day), horizon)}
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
        <StatCard label="Unteres Perzentil (10 %)" value={`×${formatNum1(result.final_p10)}`} />
        <StatCard label="Mittlerer Verlauf (50 %)" value={`×${formatNum1(result.final_p50)}`} />
        <StatCard label="Oberes Perzentil (90 %)" value={`×${formatNum1(result.final_p90)}`} />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
          Was heißt das?
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

/** 1.34 -> "1,34" (deutsches Dezimalkomma, wie core._num1). */
function formatNum1(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Handelstag-Offset -> Achsenbeschriftung: Monate bei 1 Jahr Horizont,
 * sonst Jahre (rohe Handelstag-Zahlen wären für Laien nicht lesbar). */
function formatAxisTick(day: number, horizon: Horizon): string {
  if (horizon === 1) {
    return `${Math.round(day / TRADING_DAYS_PER_MONTH)} Mon.`;
  }
  return `${Math.round(day / TRADING_DAYS_PER_YEAR)} J.`;
}

function formatTooltipLabel(day: number, horizon: Horizon): string {
  if (horizon === 1) {
    const months = Math.round(day / TRADING_DAYS_PER_MONTH);
    return `nach ${months} ${months === 1 ? "Monat" : "Monaten"}`;
  }
  const years = Math.round(day / TRADING_DAYS_PER_YEAR);
  return `nach ${years} ${years === 1 ? "Jahr" : "Jahren"}`;
}
