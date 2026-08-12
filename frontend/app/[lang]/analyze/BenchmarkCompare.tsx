"use client";

// Vergleich des frei zusammengestellten Portfolios mit einem festen
// Vergleichsindex (POST /risk/benchmark-compare). Gleiches Muster wie
// StressView/SimulationView: feste Optionen als Buttons, dependent Query
// nach Auswahl (FRONTEND_DECISIONS §1: POST-als-Query, semantisch ein Read).
// Kein Zeitverlauf: der Endpunkt liefert zwei Momentaufnahmen (Portfolio
// vs. EIN gewählter Index), keine Kurshistorie zum Charten — deshalb
// Vergleichsbalken statt eines Liniencharts.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, getRiskBenchmarks, postRiskBenchmarkCompare } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { benchmarkTitle } from "@/lib/i18n/labels";
import { canonicalWeights } from "@/lib/portfolio";
import type { BenchmarkCompareOut, PortfolioIn } from "@/lib/types";

export function BenchmarkCompare({ portfolio }: { portfolio: PortfolioIn }) {
  const { locale } = useI18n();
  const [benchmarkId, setBenchmarkId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["risk", "benchmarks"],
    queryFn: getRiskBenchmarks,
  });

  const compareQuery = useQuery({
    queryKey: [
      "risk",
      "benchmark-compare",
      canonicalWeights(portfolio.weights),
      benchmarkId,
    ],
    queryFn: () =>
      postRiskBenchmarkCompare({ portfolio, benchmark_id: benchmarkId! }),
    enabled: benchmarkId !== null,
  });

  if (listQuery.error instanceof ApiError) {
    return (
      <ErrorNotice
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {listQuery.isPending || !listQuery.data ? (
        <div className="flex gap-2">
          <Skeleton className="h-16 w-40" />
          <Skeleton className="h-16 w-40" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {listQuery.data.benchmarks.map((benchmark) => {
            const isSelected = benchmarkId === benchmark.id;
            return (
              <button
                key={benchmark.id}
                type="button"
                onClick={() => setBenchmarkId(benchmark.id)}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  borderColor: isSelected ? "var(--accent)" : "var(--border)",
                  background: isSelected ? "var(--accent-tint)" : "var(--surface)",
                  color: isSelected ? "var(--ink)" : "var(--soft)",
                }}
              >
                {benchmarkTitle(benchmark.id, benchmark.title, locale)}
              </button>
            );
          })}
        </div>
      )}

      {benchmarkId !== null && (
        <CompareResult
          query={compareQuery}
          onRetry={() => compareQuery.refetch()}
        />
      )}
    </div>
  );
}

function CompareResult({
  query,
  onRetry,
}: {
  query: ReturnType<typeof useQuery<BenchmarkCompareOut>>;
  onRetry: () => void;
}) {
  const { dict, locale } = useI18n();

  if (query.error instanceof ApiError) {
    return <ErrorNotice error={query.error} onRetry={onRetry} />;
  }

  if (query.isPending || !query.data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    );
  }

  const { portfolio, benchmark, benchmark_id, benchmark_title, comparison } = query.data;

  return (
    <div className="flex flex-col gap-4">
      {/* I18N_DECISIONS.md §5: comparison bleibt unübersetzt vom Backend
          (Phase-2-Frage). */}
      {locale !== "de" && (
        <p className="text-xs text-faint italic">{dict.analyze.benchmark.germanOnlyNotice}</p>
      )}

      <p className="text-sm text-soft">{comparison}</p>

      <CompareMetric
        label={dict.analyze.result.volatility}
        a={portfolio.metrics.volatility}
        b={benchmark.metrics.volatility}
        format={(v) => `${Math.round(v * 100)} %`}
        aLabel={dict.analyze.benchmark.yourPortfolio}
        bLabel={benchmarkTitle(benchmark_id, benchmark_title, locale)}
      />
      <CompareMetric
        label={dict.analyze.result.maxDrawdown}
        a={Math.abs(portfolio.metrics.max_drawdown)}
        b={Math.abs(benchmark.metrics.max_drawdown)}
        format={() => ""}
        rawA={`${Math.round(portfolio.metrics.max_drawdown * 100)} %`}
        rawB={`${Math.round(benchmark.metrics.max_drawdown * 100)} %`}
        aLabel={dict.analyze.benchmark.yourPortfolio}
        bLabel={benchmarkTitle(benchmark_id, benchmark_title, locale)}
      />
      <CompareMetric
        label={dict.analyze.benchmark.riskScore}
        a={portfolio.score.score}
        b={benchmark.score.score}
        format={(v) => `${Math.round(v)} / 100`}
        aLabel={dict.analyze.benchmark.yourPortfolio}
        bLabel={benchmarkTitle(benchmark_id, benchmark_title, locale)}
      />
    </div>
  );
}

/** Vergleichsbalken für eine Kennzahl: zwei Balken (Portfolio/Benchmark)
 * relativ zueinander skaliert, plus die exakten Werte. `rawA`/`rawB`
 * überschreiben die formatierten Werte, wenn das Vorzeichen erhalten
 * bleiben soll (z. B. Drawdown), die Balkenlänge aber den Betrag zeigt. */
function CompareMetric({
  label,
  a,
  b,
  format,
  rawA,
  rawB,
  aLabel,
  bLabel,
}: {
  label: string;
  a: number;
  b: number;
  format: (value: number) => string;
  rawA?: string;
  rawB?: string;
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(a, b, 1e-9);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-sunken p-3.5">
      <span className="text-xs text-muted">{label}</span>
      <BenchmarkBar
        seriesLabel={aLabel}
        value={rawA ?? format(a)}
        widthPct={(a / max) * 100}
        color="var(--ser-1)"
      />
      <BenchmarkBar
        seriesLabel={bLabel}
        value={rawB ?? format(b)}
        widthPct={(b / max) * 100}
        color="var(--ser-2)"
      />
    </div>
  );
}

function BenchmarkBar({
  seriesLabel,
  value,
  widthPct,
  color,
}: {
  seriesLabel: string;
  value: string;
  widthPct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-28 flex-none truncate text-xs text-soft">{seriesLabel}</span>
      <div className="h-2 flex-1 rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, widthPct)}%`, background: color }}
        />
      </div>
      <span className="w-16 flex-none text-right font-mono text-xs">{value}</span>
    </div>
  );
}

