"use client";

// Vergleich des frei zusammengestellten Portfolios mit einem festen
// Vergleichsindex (POST /risk/benchmark-compare). Gleiches Muster wie
// StressView/SimulationView: feste Optionen als Buttons, dependent Query
// nach Auswahl (FRONTEND_DECISIONS §1: POST-als-Query, semantisch ein Read).
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, getRiskBenchmarks, postRiskBenchmarkCompare } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { benchmarkTitle } from "@/lib/i18n/labels";
import { canonicalWeights } from "@/lib/portfolio";
import type { BenchmarkCompareOut, PortfolioIn, RiskProfileOut } from "@/lib/types";

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
    <div className="space-y-4">
      {listQuery.isPending || !listQuery.data ? (
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {listQuery.data.benchmarks.map((benchmark) => (
            <button
              key={benchmark.id}
              type="button"
              onClick={() => setBenchmarkId(benchmark.id)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                benchmarkId === benchmark.id
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              {benchmarkTitle(benchmark.id, benchmark.title, locale)}
            </button>
          ))}
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
    <div className="space-y-4">
      {/* I18N_DECISIONS.md §5: comparison bleibt unübersetzt vom Backend
          (Phase-2-Frage). */}
      {locale !== "de" && (
        <p className="text-xs text-slate-500 italic dark:text-slate-400">
          {dict.analyze.benchmark.germanOnlyNotice}
        </p>
      )}

      <p className="text-sm text-slate-700 dark:text-slate-200">
        {comparison}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileCard title={dict.analyze.benchmark.yourPortfolio} profile={portfolio} />
        <ProfileCard
          title={benchmarkTitle(benchmark_id, benchmark_title, locale)}
          profile={benchmark}
        />
      </div>
    </div>
  );
}

function ProfileCard({
  title,
  profile,
}: {
  title: string;
  profile: RiskProfileOut;
}) {
  const { dict } = useI18n();

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h4 className="text-sm font-semibold">{title}</h4>
      <Metric
        label={dict.analyze.result.volatility}
        value={`${Math.round(profile.metrics.volatility * 100)} %`}
      />
      <Metric
        label={dict.analyze.result.maxDrawdown}
        value={`${Math.round(profile.metrics.max_drawdown * 100)} %`}
      />
      <Metric
        label={dict.analyze.benchmark.riskScore}
        value={`${Math.round(profile.score.score)} / 100 (${profile.score.label})`}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
