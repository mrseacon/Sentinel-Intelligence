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
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
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
      <section className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-[74ch] flex-col gap-2">
        <div className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
          {dict.simulation.kicker}
        </div>
        <h1 className="font-serif text-[34px] leading-[1.1] font-normal">
          {dict.simulation.title}
        </h1>
        <p className="text-[14.5px] leading-relaxed text-soft">
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
    <div className="rounded-xl border border-border bg-surface p-6 shadow-elevated">
      <h2 className="text-lg font-semibold">{dict.simulation.emptyTitle}</h2>
      <p className="mt-1 text-sm text-muted">{dict.simulation.emptyBody}</p>
      <LocaleLink
        href="/depot"
        className="mt-3 inline-block rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg no-underline"
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] tracking-[0.08em] text-faint uppercase">
          {dict.simulation.horizonLabel}
        </span>
        <div className="flex w-fit gap-[3px] rounded-lg border border-border bg-sunken p-[3px]">
          {HORIZONS.map((horizon) => {
            const isSelected = selectedHorizon === horizon;
            return (
              <button
                key={horizon}
                type="button"
                onClick={() => setSelectedHorizon(horizon)}
                className="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  background: isSelected ? "var(--ink)" : "transparent",
                  color: isSelected ? "var(--bg)" : "var(--soft)",
                }}
              >
                {horizon === 1
                  ? dict.simulation.horizon1Year
                  : dict.simulation.horizonYears(horizon)}
              </button>
            );
          })}
        </div>
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
    <div className="flex flex-col gap-4">
      {/* I18N_DECISIONS.md §5: explanation/lesson/disclaimer bleiben
          unübersetzt vom Backend (Phase-2-Frage). */}
      {locale !== "de" && (
        <p className="text-xs text-faint italic">{dict.simulation.germanOnlyNotice}</p>
      )}

      {/* Frequenz-Formulierung 1:1 vom Backend übernommen (MONTE_CARLO_
          DECISIONS §5): das Frontend formuliert keine eigene
          Wahrscheinlichkeitsaussage. */}
      <p className="text-sm text-soft">{result.explanation}</p>

      {result.thin_history && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--warn)",
            background: "var(--warn-tint)",
            color: "var(--warn)",
          }}
        >
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

      <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold">{dict.simulation.chartTitle}</h2>
          <div className="flex flex-wrap gap-4">
            <LegendSwatch kind="band" color="var(--accent-tint)" borderColor="var(--ser-1)" label={dict.simulation.legendBand} />
            <LegendSwatch kind="line" color="var(--ser-1)" label={dict.simulation.legendMedian} />
            <LegendSwatch kind="dashed" color="var(--ser-2)" label={dict.simulation.legendStart} />
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis
                dataKey="day"
                tickFormatter={(day: number) => formatAxisTick(day, horizon, dict)}
                minTickGap={40}
                tick={{ fill: "var(--faint)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border-strong)" }}
                tickLine={{ stroke: "var(--border-strong)" }}
              />
              <YAxis
                tickFormatter={(v: number) => fmt(v)}
                domain={["auto", "auto"]}
                tick={{ fill: "var(--faint)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border-strong)" }}
                tickLine={{ stroke: "var(--border-strong)" }}
              />
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
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12.5,
                }}
                labelStyle={{ color: "var(--muted)" }}
                itemStyle={{ color: "var(--ink)" }}
              />
              <ReferenceLine y={1} stroke="var(--ser-2)" strokeDasharray="6 5" strokeWidth={2} />
              <Area
                dataKey="band"
                stroke="none"
                fill="var(--accent-tint)"
                isAnimationActive={false}
              />
              <Line
                dataKey="p50"
                dot={false}
                strokeWidth={2.6}
                stroke="var(--ser-1)"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={dict.simulation.stats.p10} value={fmt(result.final_p10)} />
        <StatCard label={dict.simulation.stats.p50} value={fmt(result.final_p50)} />
        <StatCard label={dict.simulation.stats.p90} value={fmt(result.final_p90)} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
        <h2 className="mb-3 text-[15px] font-semibold">
          {dict.simulation.assumptions.title}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AssumptionTile
            label={dict.simulation.assumptions.horizon}
            value={
              horizon === 1
                ? dict.simulation.horizon1Year
                : dict.simulation.horizonYears(horizon)
            }
          />
          <AssumptionTile
            label={dict.simulation.assumptions.paths}
            value={formatDecimal(result.n_paths, locale, 0)}
          />
          <AssumptionTile
            label={dict.simulation.assumptions.history}
            value={dict.simulation.assumptions.years(
              formatDecimal(result.history_years, locale, 1),
            )}
          />
          <AssumptionTile
            label={dict.simulation.assumptions.recyclingFactor}
            value={dict.simulation.assumptions.factor(
              formatDecimal(result.recycling_factor, locale, 1),
            )}
          />
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-soft">
          {dict.common.whatDoesThisMean}
        </summary>
        <p className="mt-2 text-soft">{result.lesson}</p>
      </details>

      {/* Fester Disclaimer, absichtlich NICHT aufklappbar (Prinzip 3 /
          Designprinzip 1): muss immer sichtbar sein. */}
      <p className="text-xs text-faint">{result.disclaimer}</p>
    </div>
  );
}

function LegendSwatch({
  kind,
  color,
  borderColor,
  label,
}: {
  kind: "line" | "dashed" | "band";
  color: string;
  borderColor?: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-soft">
      {kind === "line" && (
        <span className="h-[3px] w-[18px] rounded" style={{ background: color }} />
      )}
      {kind === "dashed" && (
        <span
          className="w-[18px] border-t-2"
          style={{ borderColor: color, borderStyle: "dashed" }}
        />
      )}
      {kind === "band" && (
        <span
          className="h-[10px] w-[18px] rounded-[3px] border"
          style={{ background: color, borderColor }}
        />
      )}
      {label}
    </span>
  );
}

function AssumptionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-3">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 shadow-elevated">
      <p className="text-[11px] tracking-[0.08em] text-faint uppercase">{label}</p>
      <p className="font-mono text-[22px] tracking-[-0.02em]">{value}</p>
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
