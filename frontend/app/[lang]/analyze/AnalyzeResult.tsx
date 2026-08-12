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

const LABEL_TINT: Record<RiskScoreOut["label"], string> = {
  Low: "var(--ok-tint)",
  Moderate: "var(--warn-tint)",
  High: "var(--alert-tint)",
  Severe: "var(--alert-tint)",
};

const LABEL_INK: Record<RiskScoreOut["label"], string> = {
  Low: "var(--ok)",
  Moderate: "var(--warn)",
  High: "var(--alert)",
  Severe: "var(--alert)",
};

const LABEL_ICON: Record<RiskScoreOut["label"], string> = {
  Low: "✓",
  Moderate: "!",
  High: "✕",
  Severe: "✕",
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
  const scoreLeft = `${Math.min(100, Math.max(0, score.score))}%`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold">{dict.analyze.result.riskScore}</h3>
          <span className="text-xs text-muted">{dict.analyze.score.hint}</span>
        </div>

        <div className="flex items-end gap-3.5">
          <span className="font-mono text-[46px] leading-none tracking-[-0.03em]">
            {Math.round(score.score)}
          </span>
          <span className="pb-1 font-mono text-[15px] text-faint">/ 100</span>
          <span
            className="mb-1 inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 transition-colors"
            style={{ background: LABEL_TINT[score.label], color: LABEL_INK[score.label] }}
          >
            <span className="text-[11px] font-bold" aria-hidden="true">
              {LABEL_ICON[score.label]}
            </span>
            <span className="text-xs font-semibold">{labelText}</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="relative h-2.5 rounded-full border border-border bg-sunken">
            <div
              className="absolute -top-1 -bottom-1 w-[3px] rounded-sm bg-ink transition-[left] duration-500"
              style={{ left: scoreLeft }}
            />
          </div>
          <div className="flex justify-between font-mono text-[10.5px] text-faint">
            <span>{dict.analyze.score.gaugeLow}</span>
            <span>{dict.analyze.score.gaugeHigh}</span>
          </div>
        </div>

        {score.drivers.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-border pt-3.5">
            {score.drivers.map((driver) => (
              <div
                key={driver.factor}
                className="grid grid-cols-[minmax(0,150px)_1fr_44px] items-center gap-3"
              >
                <span className="truncate text-[13px]">{driver.factor}</span>
                <div className="h-1.5 rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${Math.min(100, driver.contribution * 100)}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs text-soft">
                  {Math.round(driver.contribution * 100)} %
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-faint">{dict.analyze.score.note}</p>
      </div>

      <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
        <StatTile
          label={dict.analyze.result.volatility}
          value={`${Math.round(metrics.volatility * 100)} %`}
        />
        <StatTile
          label={dict.analyze.result.maxDrawdown}
          value={`${Math.round(metrics.max_drawdown * 100)} %`}
          tone="negative"
        />
        <StatTile
          label={dict.analyze.result.diversificationRatio}
          value={metrics.diversification_ratio.toFixed(2)}
        />
        <StatTile
          label={dict.analyze.result.var95}
          value={`${(metrics.var_95 * 100).toFixed(2)} %`}
          tone="negative"
        />
        <StatTile
          label={dict.analyze.result.cvar95}
          value={`${(metrics.cvar_95 * 100).toFixed(2)} %`}
          tone="negative"
        />
        <StatTile
          label={dict.analyze.result.hhi}
          value={metrics.hhi === null ? dict.common.notAvailable : metrics.hhi.toFixed(2)}
        />
      </div>

      <div className="border-t border-border pt-5">
        <p className="mb-2 text-[11px] tracking-[0.08em] text-faint uppercase">
          {dict.analyze.result.riskContributionPerPosition}
        </p>
        <div className="flex flex-col gap-2">
          {Object.entries(risk_contribution)
            .sort(([, a], [, b]) => b - a)
            .map(([ticker, share]) => (
              <div key={ticker} className="grid grid-cols-[80px_1fr_44px] items-center gap-3">
                <span className="font-mono text-xs tracking-[0.04em]">{ticker}</span>
                <div className="h-1.5 rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${Math.min(100, share * 100)}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs text-soft">
                  {Math.round(share * 100)} %
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <ReportDownloadButton portfolio={portfolio} />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className="font-mono text-lg"
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
