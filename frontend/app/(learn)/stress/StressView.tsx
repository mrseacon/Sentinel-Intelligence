"use client";

// Client-Teil der Stress-Seite (page.tsx bleibt Server-Komponente wegen
// `metadata`), gleiches Muster wie AmpelView. Das Portfolio kommt
// ausschließlich aus den Depot-Positionen (FRONTEND_DECISIONS §4) —
// kein eigenes Eingabeformular. Preset-Auswahl -> dependent Query auf
// POST /stress/replay (FRONTEND_DECISIONS §1: POST-als-Query, da
// semantisch ein Read).
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, getStressPresets, postStressReplay } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { canonicalWeights, derivePortfolioWeights } from "@/lib/portfolio";
import type {
  PositionValueOut,
  ScenarioPresetOut,
  StressReplayOut,
} from "@/lib/types";

export function StressView() {
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
        <h1 className="text-2xl font-semibold">Historischer Stress-Test</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Wie hätte sich dein heutiges Depot in einer vergangenen Krise
          entwickelt? Wähle ein Szenario aus.
        </p>
      </div>

      <StressContent
        hasTransactions={depot.transactions.length > 0}
        isValuationLoading={isValuationLoading}
        valuationError={valuationError}
        positions={valuation?.positions}
      />
    </section>
  );
}

function StressContent({
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

  return <StressResult positions={positions} />;
}

function EmptyHint() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Noch keine Positionen</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Der Stress-Test braucht ein Depot mit mindestens einer Position.
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

function StressResult({ positions }: { positions: PositionValueOut[] }) {
  const weights = derivePortfolioWeights(positions);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    null,
  );

  const presetsQuery = useQuery({
    queryKey: ["stress", "presets"],
    queryFn: getStressPresets,
  });

  const replayQuery = useQuery({
    queryKey: [
      "stress",
      "replay",
      canonicalWeights(weights),
      selectedPresetId,
    ],
    queryFn: () =>
      postStressReplay({
        portfolio: { weights },
        preset_id: selectedPresetId!,
      }),
    enabled: selectedPresetId !== null,
  });

  return (
    <div className="space-y-6">
      <PresetPicker
        presetsQuery={presetsQuery}
        selectedPresetId={selectedPresetId}
        onSelect={setSelectedPresetId}
      />

      {selectedPresetId !== null && (
        <ReplayResult
          replayQuery={replayQuery}
          onRetry={() => replayQuery.refetch()}
        />
      )}
    </div>
  );
}

function PresetPicker({
  presetsQuery,
  selectedPresetId,
  onSelect,
}: {
  presetsQuery: ReturnType<
    typeof useQuery<{ presets: ScenarioPresetOut[] }>
  >;
  selectedPresetId: string | null;
  onSelect: (id: string) => void;
}) {
  if (presetsQuery.error instanceof ApiError) {
    return (
      <ErrorNotice
        error={presetsQuery.error}
        onRetry={() => presetsQuery.refetch()}
      />
    );
  }

  if (presetsQuery.isPending || !presetsQuery.data) {
    return (
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-16 w-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {presetsQuery.data.presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset.id)}
          className={`rounded-lg border px-4 py-2 text-left text-sm ${
            selectedPresetId === preset.id
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          }`}
        >
          <span className="block font-medium">{preset.title}</span>
          <span
            className={
              selectedPresetId === preset.id
                ? "text-xs text-slate-300 dark:text-slate-600"
                : "text-xs text-slate-500 dark:text-slate-400"
            }
          >
            {formatDeDate(preset.start)} bis {formatDeDate(preset.end)}
          </span>
        </button>
      ))}
    </div>
  );
}

function ReplayResult({
  replayQuery,
  onRetry,
}: {
  replayQuery: ReturnType<typeof useQuery<StressReplayOut>>;
  onRetry: () => void;
}) {
  if (replayQuery.error instanceof ApiError) {
    return <ErrorNotice error={replayQuery.error} onRetry={onRetry} />;
  }

  if (replayQuery.isPending || !replayQuery.data) {
    return <Skeleton className="h-72 w-full" />;
  }

  const result = replayQuery.data;
  const coveragePct = Math.round(result.coverage * 100);

  const rows = result.dates.map((date, i) => ({
    date,
    factor: result.value_path[i],
  }));

  const troughIndex = result.value_path.reduce(
    (minI, v, i, arr) => (v < arr[minI] ? i : minI),
    0,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {result.explanation}
      </p>

      {result.excluded_tickers.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>{coveragePct} % deines Depots simuliert.</strong> Nicht
          enthalten: {result.excluded_tickers.join(", ")} (im Zeitraum noch
          nicht handelbar).
        </div>
      )}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 36 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatMonthYear}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round((v - 1) * 100)} %`}
            />
            <Tooltip
              formatter={(value) => [
                `${Math.round((Number(value) - 1) * 100)} %`,
                "Depotwert",
              ]}
              labelFormatter={(label) => formatDeDate(String(label))}
            />
            <Line
              dataKey="factor"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
              stroke="#0f172a"
            />
            <ReferenceDot
              x={rows[troughIndex]?.date}
              y={result.value_path[troughIndex]}
              r={4}
              fill="#dc2626"
              stroke="none"
              label={{ value: "Tiefpunkt", position: "top", fontSize: 11 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Maximaler Drawdown"
          value={`${Math.round(result.max_drawdown * 100)} %`}
          tone="negative"
        />
        <StatCard
          label="Rendite im Zeitraum"
          value={`${result.total_return >= 0 ? "+" : ""}${Math.round(
            result.total_return * 100,
          )} %`}
          tone={result.total_return >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Volatilität im Zeitraum"
          value={`${Math.round(result.volatility * 100)} %`}
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
          Was heißt das?
        </summary>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {result.lesson}
        </p>
      </details>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {result.disclaimer}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="text-slate-600 dark:text-slate-300">
          Wohin könnte sich dein Depot in Zukunft entwickeln?
        </span>
        <Link
          href="/simulation"
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Zur Simulation
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === "positive"
            ? "text-emerald-600"
            : tone === "negative"
              ? "text-red-600"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** "2007-10-09" -> "09.10.2007". Manuelles Parsing statt `Date`, damit
 * keine Zeitzonen-Verschiebung um einen Tag entstehen kann. */
function formatDeDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/** "2007-10-09" -> "Okt 07" (Achsenbeschriftung, keine Zeitzonen-Logik). */
function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${SHORT_MONTHS[Number(month) - 1]} ${year.slice(2)}`;
}
