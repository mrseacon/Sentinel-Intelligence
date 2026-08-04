"use client";

// POST /risk/analyze für ein frei zusammengestelltes Portfolio (nicht
// das Paper-Depot). Gleiches Karten-/Skeleton-/ErrorNotice-Muster wie
// AmpelView, aber anderes Schema: Score + Treiber statt drei Ampeln.
import { useQuery } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { ReportDownloadButton } from "@/components/ReportDownloadButton";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, postRiskAnalyze } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { canonicalWeights } from "@/lib/portfolio";
import type { PortfolioIn, RiskScoreOut } from "@/lib/types";

const LABEL_BADGE: Record<RiskScoreOut["label"], string> = {
  Low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  Moderate: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  Severe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function AnalyzeResult({ portfolio }: { portfolio: PortfolioIn }) {
  const { dict } = useI18n();
  const query = useQuery({
    queryKey: ["risk", "analyze", canonicalWeights(portfolio.weights)],
    queryFn: () => postRiskAnalyze({ portfolio }),
  });

  if (query.error instanceof ApiError) {
    return (
      <ErrorNotice error={query.error} onRetry={() => query.refetch()} />
    );
  }

  if (query.isPending || !query.data) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32 sm:col-span-3" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const { score, metrics, risk_contribution } = query.data;
  const labelText = dict.analyze.result.labels[score.label];
  const labelBadge = LABEL_BADGE[score.label];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 border-l-4 border-l-slate-400 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{dict.analyze.result.riskScore}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${labelBadge}`}
          >
            {labelText}
          </span>
        </div>
        <p className="mt-1 text-2xl font-semibold">
          {Math.round(score.score)} / 100
        </p>

        {score.drivers.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {dict.analyze.result.topDrivers}
            </p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {score.drivers.map((driver) => (
                <li key={driver.factor} className="flex justify-between">
                  <span>{driver.factor}</span>
                  <span>{Math.round(driver.contribution * 100)} %</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={dict.analyze.result.volatility}
          value={`${Math.round(metrics.volatility * 100)} %`}
        />
        <StatCard
          label={dict.analyze.result.maxDrawdown}
          value={`${Math.round(metrics.max_drawdown * 100)} %`}
          tone="negative"
        />
        <StatCard
          label={dict.analyze.result.diversificationRatio}
          value={metrics.diversification_ratio.toFixed(2)}
        />
        <StatCard
          label={dict.analyze.result.var95}
          value={`${(metrics.var_95 * 100).toFixed(2)} %`}
          tone="negative"
        />
        <StatCard
          label={dict.analyze.result.cvar95}
          value={`${(metrics.cvar_95 * 100).toFixed(2)} %`}
          tone="negative"
        />
        <StatCard
          label={dict.analyze.result.hhi}
          value={metrics.hhi === null ? dict.common.notAvailable : metrics.hhi.toFixed(2)}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {dict.analyze.result.riskContributionPerPosition}
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {Object.entries(risk_contribution)
            .sort(([, a], [, b]) => b - a)
            .map(([ticker, share]) => (
              <li
                key={ticker}
                className="flex justify-between text-slate-700 dark:text-slate-200"
              >
                <span>{ticker}</span>
                <span>{Math.round(share * 100)} %</span>
              </li>
            ))}
        </ul>
      </div>

      <ReportDownloadButton portfolio={portfolio} />
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
