"use client";

// Trade-Dialog (FRONTEND_DECISIONS.md §7): Preisvorschau via POST
// /paper/quote (semantisch ein Read -> Query, §1), Ausführung via POST
// /paper/execute (echte Mutation, §1) — nur die vom Backend
// zurückgegebene Transaktion wird lokal übernommen (addTransaction), das
// Frontend erfindet keine eigene id/executed_at (ARCHITECTURE §3/§4.1).
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, postPaperExecute, postPaperQuote } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { formatCurrency, formatPercent } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isValidTicker } from "@/lib/limits";
import { POPULAR_TICKERS } from "@/lib/popular-tickers";
import type { Side } from "@/lib/types";

interface TradeFormProps {
  defaultTicker?: string;
  defaultQuantity?: number;
  onExecuted?: () => void;
}

interface QuoteParams {
  ticker: string;
  side: Side;
  quantity: number;
}

const fieldLabelClass =
  "text-[11px] tracking-[0.08em] text-faint uppercase";
const fieldInputClass =
  "rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm focus:border-accent focus:outline-none";

export function TradeForm({
  defaultTicker = "",
  defaultQuantity = 1,
  onExecuted,
}: TradeFormProps) {
  const { depot, addTransaction, valuation } = useDepot();
  const { dict, locale } = useI18n();

  const [ticker, setTicker] = useState(defaultTicker);
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [side, setSide] = useState<Side>("BUY");
  const [previewParams, setPreviewParams] = useState<QuoteParams | null>(null);

  const tickerValid = ticker.length > 0 && isValidTicker(ticker);
  const quantityValid = Number.isInteger(quantity) && quantity > 0;

  const quoteQuery = useQuery({
    queryKey: [
      "paper",
      "quote",
      previewParams?.ticker,
      previewParams?.side,
      previewParams?.quantity,
    ],
    queryFn: () => postPaperQuote(previewParams!),
    enabled: previewParams !== null,
  });

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!depot) throw new Error("Depot not loaded yet.");
      return postPaperExecute({
        account: depot.account,
        transactions: depot.transactions,
        ticker,
        side,
        quantity,
      });
    },
    onSuccess: (transaction) => {
      addTransaction(transaction);
      setPreviewParams(null);
      onExecuted?.();
    },
  });

  function updateField(
    next: Partial<{ ticker: string; quantity: number; side: Side }>,
  ) {
    if (next.ticker !== undefined) setTicker(next.ticker.toUpperCase());
    if (next.quantity !== undefined) setQuantity(next.quantity);
    if (next.side !== undefined) setSide(next.side);
    // Eingabe geändert -> alte Preisvorschau/Ausführungsfehler verwerfen.
    setPreviewParams(null);
    executeMutation.reset();
  }

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!tickerValid || !quantityValid) return;
    setPreviewParams({ ticker, side, quantity });
  }

  const quote = quoteQuery.data;

  // Reine Anzeige-Arithmetik aus bereits vom Backend gelieferten Werten
  // (quote.cash_delta/gross_value, valuation.*) — keine eigene Risiko-
  // oder Positionsberechnung (§Harte Regeln 1). "Cash danach" =
  // cash + cash_delta laut Kommentar in lib/types.ts.
  const cashBefore = valuation?.cash ?? depot?.account.start_cash ?? 0;
  const totalBefore = valuation?.total_value ?? depot?.account.start_cash ?? 0;
  const currentPositionValue =
    valuation?.positions.find((p) => p.ticker === quote?.ticker)
      ?.market_value ?? 0;

  let cashAfterValue = cashBefore;
  let weightAfterValue = 0;
  if (quote) {
    const deltaMarketValue =
      quote.side === "BUY" ? quote.gross_value : -quote.gross_value;
    cashAfterValue = cashBefore + quote.cash_delta;
    const newPositionValue = Math.max(
      0,
      currentPositionValue + deltaMarketValue,
    );
    const newTotalValue = totalBefore + quote.cash_delta + deltaMarketValue;
    weightAfterValue = newTotalValue > 0 ? newPositionValue / newTotalValue : 0;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className={fieldLabelClass}>{dict.tradeForm.popularTickers}</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {POPULAR_TICKERS.map((popular) => (
            <button
              key={popular.ticker}
              type="button"
              aria-label={dict.tradeForm.selectAria(popular.name)}
              onClick={() => updateField({ ticker: popular.ticker })}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              {popular.name} <span className="text-faint">{popular.ticker}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handlePreview} className="flex flex-col gap-4">
        <div className="flex gap-[3px] rounded-lg border border-border bg-sunken p-[3px]">
          {(["BUY", "SELL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateField({ side: s })}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                side === s
                  ? "bg-surface text-ink shadow-elevated"
                  : "text-muted"
              }`}
            >
              {s === "BUY" ? dict.tradeForm.buy : dict.tradeForm.sell}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>{dict.tradeForm.ticker}</span>
          <input
            value={ticker}
            maxLength={15}
            onChange={(e) => updateField({ ticker: e.target.value })}
            placeholder="AAPL"
            className={`${fieldInputClass} uppercase`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>{dict.tradeForm.quantity}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) =>
                updateField({ quantity: Math.trunc(Number(e.target.value)) })
              }
              className={fieldInputClass}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>{dict.tradeForm.showPrice}</span>
            <div className="rounded-md border border-border bg-sunken px-3 py-2.5 font-mono text-sm text-soft">
              {quote ? formatCurrency(quote.price, locale) : "–"}
            </div>
          </div>
        </div>

        {ticker.length > 0 && !tickerValid && (
          <p className="text-xs text-alert">{dict.tradeForm.tickerFormatError}</p>
        )}

        {quoteQuery.isPending && previewParams && (
          <Skeleton className="h-24 w-full" />
        )}

        {quoteQuery.error instanceof ApiError && (
          <ErrorNotice
            error={quoteQuery.error}
            onRetry={() => quoteQuery.refetch()}
          />
        )}

        {quote && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-sunken p-3">
            <SummaryRow
              label={dict.tradeForm.orderVolume}
              value={formatCurrency(quote.gross_value, locale)}
            />
            <SummaryRow
              label={dict.tradeForm.cashAfter}
              value={formatCurrency(cashAfterValue, locale)}
              tone={cashAfterValue < 0 ? "alert" : undefined}
            />
            <SummaryRow
              label={dict.tradeForm.weightAfter}
              value={formatPercent(weightAfterValue, locale, 1)}
            />
            <SummaryRow
              label={dict.tradeForm.feeLabel}
              value={formatCurrency(quote.fees, locale)}
            />
          </div>
        )}

        <button
          type={quote ? "button" : "submit"}
          onClick={quote ? () => executeMutation.mutate() : undefined}
          disabled={
            quote
              ? executeMutation.isPending
              : !tickerValid || !quantityValid
          }
          className="rounded-lg bg-ink py-3 text-sm font-semibold tracking-[0.01em] text-bg transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {quote
            ? executeMutation.isPending
              ? dict.tradeForm.executing
              : dict.tradeForm.confirmTrade
            : dict.tradeForm.showPrice}
        </button>

        {executeMutation.error instanceof ApiError && (
          <ErrorNotice error={executeMutation.error} />
        )}
      </form>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "alert";
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span
        className={`font-mono ${tone === "alert" ? "text-alert" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}
