"use client";

// Client-Teil der Depot-Seite (page.tsx bleibt Server-Komponente wegen
// `metadata`). Depotwert/Cash/Positionen kommen ausschließlich aus
// useDepot()'s valuation (ARCHITECTURE §3: Backend bleibt einzige
// Quelle der Wahrheit für Positionsberechnung).
import { useState } from "react";

import { ErrorNotice } from "@/components/ErrorNotice";
import { PositionNews } from "@/components/PositionNews";
import { Skeleton } from "@/components/Skeleton";
import type { ApiError } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LocaleLink } from "@/lib/i18n/link";
import { formatCurrency, formatPercent } from "@/lib/i18n/format";
import type { AccountValuationOut } from "@/lib/types";

import { TradeForm } from "./TradeForm";

export function DepotView() {
  const { depot, valuation, isValuationLoading, valuationError } =
    useDepot();
  const { dict, locale } = useI18n();
  const [justTraded, setJustTraded] = useState(false);

  // Depot noch nicht aus localStorage gelesen (usePaperDepot §2-SSR-Gotcha).
  if (depot === null) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  const hasTransactions = depot.transactions.length > 0;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{dict.depot.title}</h1>
        <p className="text-slate-600 dark:text-slate-300">
          {dict.depot.subtitle(formatCurrency(depot.account.start_cash, locale))}
        </p>
      </div>

      {hasTransactions ? (
        <DepotOverview
          isLoading={isValuationLoading}
          error={valuationError}
          valuation={valuation}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">{dict.depot.firstTradeTitle}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {dict.depot.firstTradeBody}
          </p>
        </div>
      )}

      {justTraded && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <span>{dict.depot.justTraded}</span>
          <LocaleLink
            href="/ampel"
            className="shrink-0 rounded-md border border-emerald-500 px-3 py-1 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900"
          >
            {dict.depot.goToAmpel}
          </LocaleLink>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold">
          {hasTransactions ? dict.depot.newTrade : dict.depot.tradeDialog}
        </h2>
        <div className="mt-3">
          <TradeForm
            defaultTicker={hasTransactions ? "" : "AAPL"}
            onExecuted={() => setJustTraded(true)}
          />
        </div>
      </div>
    </section>
  );
}

function DepotOverview({
  isLoading,
  error,
  valuation,
}: {
  isLoading: boolean;
  error: ApiError | null;
  valuation: AccountValuationOut | undefined;
}) {
  const { dict, locale } = useI18n();

  if (error) return <ErrorNotice error={error} />;

  if (isLoading || !valuation) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={dict.depot.stats.value}
          value={formatCurrency(valuation.total_value, locale)}
        />
        <StatCard
          label={dict.depot.stats.cash}
          value={formatCurrency(valuation.cash, locale)}
        />
        <StatCard
          label={dict.depot.stats.totalPnl}
          value={`${valuation.total_pnl >= 0 ? "+" : ""}${formatCurrency(
            valuation.total_pnl,
            locale,
          )} (${formatPercent(valuation.total_pnl_pct, locale, 1)})`}
          tone={valuation.total_pnl >= 0 ? "positive" : "negative"}
        />
      </div>

      {valuation.positions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1 pr-4 font-medium">{dict.depot.table.ticker}</th>
                <th className="py-1 pr-4 font-medium">{dict.depot.table.quantity}</th>
                <th className="py-1 pr-4 font-medium">
                  {dict.depot.table.avgBuyPrice}
                </th>
                <th className="py-1 pr-4 font-medium">{dict.depot.table.price}</th>
                <th className="py-1 pr-4 font-medium">{dict.depot.table.value}</th>
                <th className="py-1 pr-4 font-medium">{dict.depot.table.pnl}</th>
                <th className="py-1 font-medium">{dict.depot.table.news}</th>
              </tr>
            </thead>
            <tbody>
              {valuation.positions.map((p) => (
                <tr
                  key={p.ticker}
                  className="border-t border-slate-200 dark:border-slate-800"
                >
                  <td className="py-1.5 pr-4 font-medium">{p.ticker}</td>
                  <td className="py-1.5 pr-4">{p.quantity}</td>
                  <td className="py-1.5 pr-4">
                    {formatCurrency(p.avg_buy_price, locale)}
                  </td>
                  <td className="py-1.5 pr-4">
                    {formatCurrency(p.current_price, locale)}
                  </td>
                  <td className="py-1.5 pr-4">
                    {formatCurrency(p.market_value, locale)}
                  </td>
                  <td
                    className={`py-1.5 pr-4 ${
                      p.unrealized_pnl >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {p.unrealized_pnl >= 0 ? "+" : ""}
                    {formatCurrency(p.unrealized_pnl, locale)}
                  </td>
                  <td className="py-1.5">
                    <PositionNews ticker={p.ticker} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
