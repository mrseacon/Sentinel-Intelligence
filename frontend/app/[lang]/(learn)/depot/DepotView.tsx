"use client";

// Client-Teil der Depot-Seite (page.tsx bleibt Server-Komponente wegen
// `metadata`). Depotwert/Cash/Positionen kommen ausschließlich aus
// useDepot()'s valuation (ARCHITECTURE §3: Backend bleibt einzige
// Quelle der Wahrheit für Positionsberechnung). Gewichtungen (Donut,
// Tabellen-Balken) sind reine Anzeige-Arithmetik aus market_value/
// total_value — keine eigene Risikoberechnung (§Harte Regeln 1).
import { useState } from "react";

import { ErrorNotice } from "@/components/ErrorNotice";
import { PositionNews } from "@/components/PositionNews";
import { Skeleton } from "@/components/Skeleton";
import type { ApiError } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { formatCurrency, formatPercent } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LocaleLink } from "@/lib/i18n/link";
import type { AccountValuationOut, PositionValueOut } from "@/lib/types";

import { TradeForm } from "./TradeForm";

const SERIES_COLORS = 6;
const POSITION_GRID = "grid-cols-[1.7fr_.7fr_.9fr_1fr_1.2fr_.9fr]";

function seriesColor(index: number): string {
  return `var(--ser-${(index % SERIES_COLORS) + 1})`;
}

export function DepotView() {
  const { depot, valuation, isValuationLoading, valuationError } =
    useDepot();
  const { dict, locale } = useI18n();
  const [justTraded, setJustTraded] = useState(false);

  // Depot noch nicht aus localStorage gelesen (usePaperDepot §2-SSR-Gotcha).
  if (depot === null) {
    return (
      <section className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  const hasTransactions = depot.transactions.length > 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
          {dict.depot.kicker(formatCurrency(depot.account.start_cash, locale))}
        </div>
        <h1 className="font-serif text-[34px] leading-[1.1] font-normal">
          {dict.depot.title}
        </h1>
      </div>

      {justTraded && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-ok bg-ok-tint px-4 py-3 text-sm text-ok">
          <span>{dict.depot.justTraded}</span>
          <LocaleLink
            href="/ampel"
            className="shrink-0 rounded-md border border-ok px-3 py-1 font-medium hover:bg-ok/10"
          >
            {dict.depot.goToAmpel}
          </LocaleLink>
        </div>
      )}

      {hasTransactions ? (
        <DepotOverview
          isLoading={isValuationLoading}
          error={valuationError}
          valuation={valuation}
          onExecuted={() => setJustTraded(true)}
        />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-elevated">
            <h2 className="text-lg font-semibold">
              {dict.depot.firstTradeTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {dict.depot.firstTradeBody}
            </p>
          </div>
          <OrderCard heading={dict.depot.tradeDialog}>
            <TradeForm
              defaultTicker="AAPL"
              onExecuted={() => setJustTraded(true)}
            />
          </OrderCard>
        </>
      )}
    </section>
  );
}

function OrderCard({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
      <h2 className="mb-4 text-[15px] font-semibold">{heading}</h2>
      {children}
    </div>
  );
}

function DepotOverview({
  isLoading,
  error,
  valuation,
  onExecuted,
}: {
  isLoading: boolean;
  error: ApiError | null;
  valuation: AccountValuationOut | undefined;
  onExecuted: () => void;
}) {
  const { dict, locale } = useI18n();

  if (error) return <ErrorNotice error={error} />;

  if (isLoading || !valuation) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const positions = valuation.positions;
  const investedTotal = positions.reduce((sum, p) => sum + p.market_value, 0);
  const largest = positions.reduce<PositionValueOut | null>(
    (max, p) => (!max || p.market_value > max.market_value ? p : max),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <MetricTile
          label={dict.depot.stats.value}
          value={formatCurrency(valuation.total_value, locale)}
          sub={`${valuation.total_pnl >= 0 ? "+" : ""}${formatCurrency(
            valuation.total_pnl,
            locale,
          )} (${formatPercent(valuation.total_pnl_pct, locale, 1)})`}
          tone={valuation.total_pnl >= 0 ? "positive" : "negative"}
        />
        <MetricTile
          label={dict.depot.stats.cash}
          value={formatCurrency(valuation.cash, locale)}
          sub={dict.depot.stats.shareOfPortfolio(
            formatPercent(
              valuation.total_value > 0
                ? valuation.cash / valuation.total_value
                : 0,
              locale,
            ),
          )}
        />
        <MetricTile
          label={dict.depot.stats.invested}
          value={formatCurrency(valuation.market_value, locale)}
          sub={dict.depot.stats.shareOfPortfolio(
            formatPercent(
              valuation.total_value > 0
                ? valuation.market_value / valuation.total_value
                : 0,
              locale,
            ),
          )}
        />
        <MetricTile
          label={dict.depot.stats.positions}
          value={String(positions.length)}
          sub={
            largest
              ? dict.depot.stats.largestPosition(
                  largest.ticker,
                  formatPercent(
                    investedTotal > 0
                      ? largest.market_value / investedTotal
                      : 0,
                    locale,
                  ),
                )
              : ""
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <WeightingCard positions={positions} investedTotal={investedTotal} />
        <OrderCard heading={dict.depot.newTrade}>
          <TradeForm defaultTicker="" onExecuted={onExecuted} />
        </OrderCard>
      </div>

      {positions.length > 0 && <PositionsTable positions={positions} />}
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 shadow-elevated">
      <div className="text-[11px] tracking-[0.08em] text-faint uppercase">
        {label}
      </div>
      <div className="font-mono text-[22px] tracking-[-0.02em] text-ink">
        {value}
      </div>
      <div
        className={`text-xs ${
          tone === "positive"
            ? "text-ok"
            : tone === "negative"
              ? "text-alert"
              : "text-muted"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

function WeightingCard({
  positions,
  investedTotal,
}: {
  positions: PositionValueOut[];
  investedTotal: number;
}) {
  const { dict, locale } = useI18n();
  const [hovered, setHovered] = useState<string | null>(null);

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const { segments } = positions.reduce<{
    segments: {
      ticker: string;
      pct: number;
      color: string;
      dasharray: string;
      dashoffset: number;
    }[];
    cursor: number;
  }>(
    (acc, p, index) => {
      const pct = investedTotal > 0 ? p.market_value / investedTotal : 0;
      const dash = pct * circumference;
      const segment = {
        ticker: p.ticker,
        pct,
        color: seriesColor(index),
        dasharray: `${dash} ${circumference - dash}`,
        dashoffset: -acc.cursor,
      };
      return {
        segments: [...acc.segments, segment],
        cursor: acc.cursor + dash,
      };
    },
    { segments: [], cursor: 0 },
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-elevated">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{dict.depot.weighting}</h2>
        <span className="text-xs text-muted">{dict.depot.weightingHint}</span>
      </div>
      <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[190px_1fr]">
        <div className="relative mx-auto h-[190px] w-[190px]">
          <svg viewBox="0 0 200 200" className="block h-full w-full -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--sunken)"
              strokeWidth="19"
            />
            {segments.map((s) => (
              <circle
                key={s.ticker}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="19"
                strokeDasharray={s.dasharray}
                strokeDashoffset={s.dashoffset}
                opacity={hovered === null || hovered === s.ticker ? 1 : 0.35}
                onMouseEnter={() => setHovered(s.ticker)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer transition-opacity duration-200"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
            <div className="max-w-[128px] text-[9.5px] tracking-[0.1em] text-faint uppercase">
              {dict.depot.weightingCenterCaption}
            </div>
            <div className="font-mono text-[16.5px] tracking-[-0.02em]">
              {formatCurrency(investedTotal, locale)}
            </div>
            <div className="max-w-[128px] text-[10.5px] leading-tight text-muted">
              {dict.depot.weightingCenterSub(positions.length)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          {segments.map((s) => (
            <div
              key={s.ticker}
              onMouseEnter={() => setHovered(s.ticker)}
              onMouseLeave={() => setHovered(null)}
              className="grid grid-cols-[10px_1fr_auto] items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
              style={{
                background: hovered === s.ticker ? "var(--sunken)" : "transparent",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: s.color }}
              />
              <span className="truncate text-sm">{s.ticker}</span>
              <span className="font-mono text-xs text-soft">
                {formatPercent(s.pct, locale, 1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PositionsTable({ positions }: { positions: PositionValueOut[] }) {
  const { dict, locale } = useI18n();
  const investedTotal = positions.reduce((sum, p) => sum + p.market_value, 0);

  return (
    // data-testid: "AAPL" allein ist auf dieser Seite mehrdeutig (Donut-
    // Legende zeigt denselben Ticker) — der Testid ist der stabilere
    // Anker als Text/Rolle-Scoping über verschachtelte divs (E2E-Suite,
    // e2e/trade-flow.spec.ts), ohne die Selektor-Strategie sonst zu
    // ändern (weiterhin Text/Rolle für alles Eindeutige).
    <div
      data-testid="positions-table"
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-elevated"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4.5 pb-3.5">
        <h2 className="text-[15px] font-semibold">
          {dict.depot.positionsTitle}
        </h2>
        <span className="text-xs text-muted">{dict.depot.positionsHint}</span>
      </div>
      <div
        className={`grid ${POSITION_GRID} gap-3 border-b border-border px-5 pb-2 text-[11px] tracking-[0.07em] text-faint uppercase`}
      >
        <span>{dict.depot.table.ticker}</span>
        <span className="text-right">{dict.depot.table.quantity}</span>
        <span className="text-right">{dict.depot.table.price}</span>
        <span className="text-right">{dict.depot.table.value}</span>
        <span>{dict.depot.table.weight}</span>
        <span className="text-right">{dict.depot.table.pnl}</span>
      </div>
      {positions.map((p, index) => {
        const pct = investedTotal > 0 ? p.market_value / investedTotal : 0;
        return (
          <div key={p.ticker} className="border-b border-border last:border-0">
            <div
              className={`grid ${POSITION_GRID} items-center gap-3 px-5 py-3`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: seriesColor(index) }}
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-mono text-[12.5px] tracking-[0.04em]">
                    {p.ticker}
                  </span>
                  <span className="truncate text-[11px] text-muted">
                    {dict.depot.table.avgBuyPrice}{" "}
                    {formatCurrency(p.avg_buy_price, locale)}
                  </span>
                </div>
              </div>
              <span className="text-right font-mono text-[13px]">
                {p.quantity}
              </span>
              <span className="text-right font-mono text-[13px] text-soft">
                {formatCurrency(p.current_price, locale)}
              </span>
              <span className="text-right font-mono text-[13px]">
                {formatCurrency(p.market_value, locale)}
              </span>
              <div className="flex items-center gap-2.5">
                <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct * 100}%`, background: seriesColor(index) }}
                  />
                </div>
                <span className="w-11 text-right font-mono text-xs text-soft">
                  {formatPercent(pct, locale)}
                </span>
              </div>
              <span
                className={`text-right font-mono text-[13px] ${
                  p.unrealized_pnl >= 0 ? "text-ok" : "text-alert"
                }`}
              >
                {p.unrealized_pnl >= 0 ? "+" : ""}
                {formatCurrency(p.unrealized_pnl, locale)}
              </span>
            </div>
            <PositionNews ticker={p.ticker} />
          </div>
        );
      })}
    </div>
  );
}
