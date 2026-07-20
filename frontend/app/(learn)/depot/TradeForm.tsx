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
import { isValidTicker } from "@/lib/limits";
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

export function TradeForm({
  defaultTicker = "",
  defaultQuantity = 1,
  onExecuted,
}: TradeFormProps) {
  const { depot, addTransaction } = useDepot();

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
      if (!depot) throw new Error("Depot noch nicht geladen.");
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

  return (
    <div className="space-y-4">
      <form
        onSubmit={handlePreview}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label
            htmlFor="trade-ticker"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Ticker
          </label>
          <input
            id="trade-ticker"
            value={ticker}
            maxLength={15}
            onChange={(e) => updateField({ ticker: e.target.value })}
            placeholder="AAPL"
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div>
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Seite
          </span>
          <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
            {(["BUY", "SELL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateField({ side: s })}
                className={`px-3 py-1.5 text-sm font-medium ${
                  side === s
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-transparent text-slate-600 dark:text-slate-300"
                }`}
              >
                {s === "BUY" ? "Kaufen" : "Verkaufen"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor="trade-quantity"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Menge (Stück)
          </label>
          <input
            id="trade-quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) =>
              updateField({ quantity: Math.trunc(Number(e.target.value)) })
            }
            className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <button
          type="submit"
          disabled={!tickerValid || !quantityValid}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          Preis anzeigen
        </button>
      </form>

      {ticker.length > 0 && !tickerValid && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Ticker darf nur Großbuchstaben, Ziffern und . - ^ = enthalten
          (max. 15 Zeichen).
        </p>
      )}

      {quoteQuery.isPending && previewParams && (
        <Skeleton className="h-24 w-full max-w-sm" />
      )}

      {quoteQuery.error instanceof ApiError && (
        <ErrorNotice
          error={quoteQuery.error}
          onRetry={() => quoteQuery.refetch()}
        />
      )}

      {quoteQuery.data && (
        <div className="max-w-sm space-y-2 rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800">
          <p>
            {quoteQuery.data.side === "BUY" ? "Kauf" : "Verkauf"} von{" "}
            {quoteQuery.data.quantity}× {quoteQuery.data.ticker} zu{" "}
            {quoteQuery.data.price.toFixed(2)} € (Kurs von{" "}
            {new Date(quoteQuery.data.price_asof).toLocaleTimeString(
              "de-DE",
              { hour: "2-digit", minute: "2-digit" },
            )}
            )
          </p>
          <p>Gebühr: {quoteQuery.data.fees.toFixed(2)} €</p>
          <p className="font-medium">
            Cash-Änderung: {quoteQuery.data.cash_delta >= 0 ? "+" : ""}
            {quoteQuery.data.cash_delta.toFixed(2)} €
          </p>
          <button
            type="button"
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {executeMutation.isPending
              ? "Wird ausgeführt…"
              : "Trade bestätigen"}
          </button>
        </div>
      )}

      {executeMutation.error instanceof ApiError && (
        <ErrorNotice error={executeMutation.error} />
      )}
    </div>
  );
}
