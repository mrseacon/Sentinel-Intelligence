"use client";

// Client-Teil der Stress-Seite (page.tsx bleibt Server-Komponente wegen
// `metadata`), gleiches Muster wie AmpelView. Das Portfolio kommt
// ausschließlich aus den Depot-Positionen (FRONTEND_DECISIONS §4) —
// kein eigenes Eingabeformular. Preset-Auswahl -> dependent Query auf
// POST /stress/replay (FRONTEND_DECISIONS §1: POST-als-Query, da
// semantisch ein Read).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, getStressPresets, postStressReplay } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { formatIsoDate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { stressPresetTitle } from "@/lib/i18n/labels";
import { LocaleLink } from "@/lib/i18n/link";
import { canonicalWeights, derivePortfolioWeights } from "@/lib/portfolio";
import type {
  PositionValueOut,
  ScenarioPresetOut,
  StressReplayOut,
} from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

export function StressView() {
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
          {dict.stress.kicker}
        </div>
        <h1 className="font-serif text-[34px] leading-[1.1] font-normal">
          {dict.stress.title}
        </h1>
        <p className="text-[14.5px] leading-relaxed text-soft">
          {dict.stress.subtitle}
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
  const { dict } = useI18n();

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-elevated">
      <h2 className="text-lg font-semibold">{dict.stress.emptyTitle}</h2>
      <p className="mt-1 text-sm text-muted">{dict.stress.emptyBody}</p>
      <LocaleLink
        href="/depot"
        className="mt-3 inline-block rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg no-underline"
      >
        {dict.common.goToDepot}
      </LocaleLink>
    </div>
  );
}

function StressResult({ positions }: { positions: PositionValueOut[] }) {
  const { dict } = useI18n();
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
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-sunken px-4 py-3 text-sm">
        <span className="text-soft">{dict.stress.simulationLinkText}</span>
        <LocaleLink
          href="/simulation"
          className="shrink-0 rounded-md border border-border px-3 py-1 font-medium text-soft no-underline transition-colors hover:border-border-strong hover:text-ink"
        >
          {dict.stress.simulationLinkCta}
        </LocaleLink>
      </div>
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
  const { dict, locale } = useI18n();

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {presetsQuery.data.presets.map((preset) => {
        const isSelected = selectedPresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            className="flex flex-col gap-1.5 rounded-lg border px-4 py-3.5 text-left text-sm transition-colors"
            style={{
              borderColor: isSelected ? "var(--accent)" : "var(--border)",
              background: isSelected ? "var(--accent-tint)" : "var(--surface)",
            }}
          >
            <span className="flex items-center justify-between gap-2.5">
              <span className="font-semibold text-ink">
                {stressPresetTitle(preset.id, preset.title, locale)}
              </span>
              <span
                className="h-2 w-2 flex-none rounded-full transition-colors"
                style={{
                  background: isSelected ? "var(--accent)" : "var(--border-strong)",
                }}
              />
            </span>
            <span className="font-mono text-[11px] text-faint">
              {formatIsoDate(preset.start, locale)} {dict.stress.to}{" "}
              {formatIsoDate(preset.end, locale)}
            </span>
          </button>
        );
      })}
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
  const { dict, locale } = useI18n();

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
    <div className="flex flex-col gap-4">
      {/* I18N_DECISIONS.md §5: explanation/lesson/disclaimer bleiben
          unübersetzt vom Backend (Phase-2-Frage). */}
      {locale !== "de" && (
        <p className="text-xs text-faint italic">{dict.stress.germanOnlyNotice}</p>
      )}

      <p className="text-sm text-soft">{result.explanation}</p>

      {result.excluded_tickers.length > 0 && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--warn)",
            background: "var(--warn-tint)",
            color: "var(--warn)",
          }}
        >
          <strong>{dict.stress.coverage(coveragePct)}</strong>{" "}
          {dict.stress.excluded(result.excluded_tickers.join(", "))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold">{dict.stress.chartTitle}</h2>
          <div className="flex gap-4">
            <LegendSwatch kind="line" color="var(--ser-1)" label={dict.stress.legendDepot} />
            <LegendSwatch kind="dashed" color="var(--border-strong)" label={dict.stress.legendStart} />
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 16, right: 36 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={(iso: string) => formatMonthYear(iso, locale, dict.stress.monthsShort)}
                minTickGap={40}
                tick={{ fill: "var(--faint)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border-strong)" }}
                tickLine={{ stroke: "var(--border-strong)" }}
              />
              <YAxis
                tickFormatter={(v: number) => `${Math.round((v - 1) * 100)} %`}
                tick={{ fill: "var(--faint)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border-strong)" }}
                tickLine={{ stroke: "var(--border-strong)" }}
              />
              <Tooltip
                formatter={(value) => [
                  `${Math.round((Number(value) - 1) * 100)} %`,
                  dict.stress.chartValueTooltip,
                ]}
                labelFormatter={(label) => formatIsoDate(String(label), locale)}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12.5,
                }}
                labelStyle={{ color: "var(--muted)" }}
                itemStyle={{ color: "var(--ink)" }}
              />
              <ReferenceLine y={1} stroke="var(--border-strong)" strokeDasharray="2 3" />
              <Line
                dataKey="factor"
                dot={false}
                strokeWidth={2.4}
                isAnimationActive={false}
                stroke="var(--ser-1)"
              />
              <ReferenceDot
                x={rows[troughIndex]?.date}
                y={result.value_path[troughIndex]}
                r={4}
                fill="var(--surface)"
                stroke="var(--ser-1)"
                strokeWidth={2.4}
                label={{
                  value: dict.stress.trough,
                  position: "top",
                  fontSize: 11,
                  fill: "var(--soft)",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={dict.stress.stats.maxDrawdown}
          value={`${Math.round(result.max_drawdown * 100)} %`}
          tone="negative"
        />
        <StatCard
          label={dict.stress.stats.totalReturn}
          value={`${result.total_return >= 0 ? "+" : ""}${Math.round(
            result.total_return * 100,
          )} %`}
          tone={result.total_return >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label={dict.stress.stats.volatility}
          value={`${Math.round(result.volatility * 100)} %`}
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-soft">
          {dict.common.whatDoesThisMean}
        </summary>
        <p className="mt-2 text-soft">{result.lesson}</p>
      </details>

      <p className="text-xs text-faint">{result.disclaimer}</p>
    </div>
  );
}

function LegendSwatch({
  kind,
  color,
  label,
}: {
  kind: "line" | "dashed";
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-soft">
      {kind === "line" ? (
        <span className="h-[3px] w-[18px] rounded" style={{ background: color }} />
      ) : (
        <span
          className="w-[18px] border-t-2"
          style={{ borderColor: color, borderStyle: "dashed" }}
        />
      )}
      {label}
    </span>
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
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 shadow-elevated">
      <p className="text-[11px] tracking-[0.08em] text-faint uppercase">{label}</p>
      <p
        className="font-mono text-[22px] tracking-[-0.02em]"
        style={{
          color:
            tone === "positive"
              ? "var(--ok)"
              : tone === "negative"
                ? "var(--alert)"
                : "var(--ink)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

/** "2007-10-09" -> "Okt 07" (Achsenbeschriftung, keine Zeitzonen-Logik). */
function formatMonthYear(isoDate: string, locale: Locale, monthsShort: readonly string[]): string {
  const [year, month] = isoDate.split("-");
  return `${monthsShort[Number(month) - 1]} ${year.slice(2)}`;
}
