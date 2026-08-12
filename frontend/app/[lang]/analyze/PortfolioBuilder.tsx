"use client";

// Zwei gleichwertige Eingabewege für ein freies Portfolio (FRONTEND_
// DECISIONS §8/ARCHITECTURE §6): CSV-Upload und manuelle Ticker/Betrag-
// Paare, als Tabs EINER Karte statt zwei nebeneinander stehender Karten
// (Redesign-Layout). Beide melden ein fertiges PortfolioIn über
// onPortfolioReady — die Analyse-Logik lebt in AnalyzeView, nicht hier.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { ApiError, postPortfolioUpload } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isValidTicker, MAX_CSV_BYTES, MAX_PORTFOLIO_TICKERS } from "@/lib/limits";
import { POPULAR_TICKERS } from "@/lib/popular-tickers";
import type { PortfolioIn } from "@/lib/types";

interface PortfolioBuilderProps {
  onPortfolioReady: (portfolio: PortfolioIn) => void;
}

type Source = "manual" | "csv";

export function PortfolioBuilder({ onPortfolioReady }: PortfolioBuilderProps) {
  const { dict } = useI18n();
  const [source, setSource] = useState<Source>("manual");

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
      <h2 className="mb-3 text-[15px] font-semibold">{dict.analyze.source.title}</h2>
      <div className="mb-4 flex w-fit gap-[3px] rounded-lg border border-border bg-sunken p-[3px]">
        <SourceTab
          isActive={source === "manual"}
          onClick={() => setSource("manual")}
          label={dict.analyze.source.manualTab}
        />
        <SourceTab
          isActive={source === "csv"}
          onClick={() => setSource("csv")}
          label={dict.analyze.source.csvTab}
        />
      </div>

      {source === "manual" ? (
        <ManualEntryCard onPortfolioReady={onPortfolioReady} />
      ) : (
        <CsvUploadCard onPortfolioReady={onPortfolioReady} />
      )}
    </div>
  );
}

function SourceTab({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
      style={{
        background: isActive ? "var(--surface)" : "transparent",
        color: isActive ? "var(--ink)" : "var(--soft)",
        boxShadow: isActive ? "var(--shadow-elevated)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function CsvUploadCard({ onPortfolioReady }: PortfolioBuilderProps) {
  const { dict } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (toUpload: File) => postPortfolioUpload(toUpload),
    onSuccess: onPortfolioReady,
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setClientError(null);
    uploadMutation.reset();
    setFile(null);
    if (!selected) return;

    // Clientseitige Checks VOR dem Request (FRONTEND_DECISIONS §8):
    // Format und Größe sind sofort prüfbar, ein 413/422 danach wäre nur
    // ein vermeidbarer Roundtrip.
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setClientError(dict.analyze.csvUpload.onlyCsv);
      return;
    }
    if (selected.size > MAX_CSV_BYTES) {
      setClientError(
        dict.analyze.csvUpload.tooLarge(
          (selected.size / 1_000_000).toFixed(1),
          MAX_CSV_BYTES / 1_000_000,
        ),
      );
      return;
    }
    setFile(selected);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-soft">{dict.analyze.csvUpload.body}</p>

      {/* Nativer file-selector-button rendert plattformabhängig sehr
          inkonsistent (Preflight setzt ihn u.a. auf Breite/Padding 0
          zurück). Robusteres Muster: Input visuell verstecken (sr-only,
          bleibt fokussier-/tastaturbedienbar), ein <label> triggert es
          und trägt jetzt die Dropzone-Optik aus dem Redesign. */}
      <label
        htmlFor="csv-upload-input"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-border-strong bg-sunken px-5 py-7 text-center"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5 text-faint" aria-hidden="true">
          <path
            d="M10 14V4m0 0 3.4 3.4M10 4 6.6 7.4M3 16.5h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-ink">
          {dict.analyze.csvUpload.dropTitle}
        </span>
        <span className="max-w-[40ch] text-xs text-muted">
          {dict.analyze.csvUpload.dropSub}
        </span>
      </label>
      <input
        id="csv-upload-input"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="sr-only"
      />

      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-sunken p-3.5">
        <span className="text-[11px] tracking-[0.08em] text-faint uppercase">
          {dict.analyze.csvUpload.formatLabel}
        </span>
        <span className="font-mono text-[11.5px] leading-relaxed text-soft">
          {dict.analyze.csvUpload.formatHead}
        </span>
        <span className="font-mono text-[11.5px] leading-relaxed text-muted">
          {dict.analyze.csvUpload.formatRow}
        </span>
      </div>

      {clientError && <p className="text-xs text-alert">{clientError}</p>}

      {file && !clientError && (
        <p className="text-xs text-muted">
          {file.name} ({(file.size / 1000).toFixed(0)} KB)
        </p>
      )}

      {file && !clientError && (
        <button
          type="button"
          onClick={() => uploadMutation.mutate(file)}
          disabled={uploadMutation.isPending}
          className="w-fit rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
        >
          {uploadMutation.isPending
            ? dict.analyze.csvUpload.uploading
            : dict.analyze.csvUpload.upload}
        </button>
      )}

      {uploadMutation.error instanceof ApiError && (
        <ErrorNotice error={uploadMutation.error} />
      )}
    </div>
  );
}

interface ManualRow {
  id: string;
  ticker: string;
  weight: string;
}

function createRow(ticker = "", weight = ""): ManualRow {
  return { id: crypto.randomUUID(), ticker, weight };
}

function ManualEntryCard({ onPortfolioReady }: PortfolioBuilderProps) {
  const { dict } = useI18n();
  const [rows, setRows] = useState<ManualRow[]>([createRow()]);

  function updateRow(id: string, patch: Partial<ManualRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );
  }

  function addRow() {
    setRows((prev) =>
      prev.length >= MAX_PORTFOLIO_TICKERS ? prev : [...prev, createRow()],
    );
  }

  function addPopular(ticker: string) {
    setRows((prev) => {
      const emptyIndex = prev.findIndex((r) => r.ticker.trim() === "");
      if (emptyIndex >= 0) {
        const next = [...prev];
        next[emptyIndex] = { ...next[emptyIndex], ticker, weight: "1" };
        return next;
      }
      if (prev.length >= MAX_PORTFOLIO_TICKERS) return prev;
      return [...prev, createRow(ticker, "1")];
    });
  }

  const filledRows = rows.filter((r) => r.ticker.trim().length > 0);
  const hasInvalidTicker = filledRows.some(
    (r) => !isValidTicker(r.ticker.trim().toUpperCase()),
  );
  const hasInvalidWeight = filledRows.some((r) => {
    const n = Number(r.weight.replace(",", "."));
    return !Number.isFinite(n) || n <= 0;
  });
  const atLimit = rows.length >= MAX_PORTFOLIO_TICKERS;
  const canSubmit =
    filledRows.length >= 1 && !hasInvalidTicker && !hasInvalidWeight;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // Duplikate aggregieren (gleiche Semantik wie der CSV-Upload im
    // Backend, §10) statt sie stillschweigend zu überschreiben.
    const weights: Record<string, number> = {};
    for (const row of filledRows) {
      const ticker = row.ticker.trim().toUpperCase();
      const value = Number(row.weight.replace(",", "."));
      weights[ticker] = (weights[ticker] ?? 0) + value;
    }
    onPortfolioReady({ weights });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-[0.08em] text-faint uppercase">
          {dict.analyze.manualEntry.popularTickers}
        </span>
        <span className="text-xs text-muted">
          {dict.analyze.manualEntry.countOf(filledRows.length, MAX_PORTFOLIO_TICKERS)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_TICKERS.map((popular) => (
          <button
            key={popular.ticker}
            type="button"
            disabled={atLimit}
            aria-label={dict.analyze.manualEntry.addAria(popular.name)}
            onClick={() => addPopular(popular.ticker)}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-soft transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40"
          >
            {popular.name} <span className="text-faint">{popular.ticker}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {rows.map((row) => {
          const trimmed = row.ticker.trim().toUpperCase();
          const tickerInvalid = trimmed.length > 0 && !isValidTicker(trimmed);
          return (
            <div key={row.id} className="flex items-center gap-2">
              <input
                value={row.ticker}
                maxLength={15}
                placeholder={dict.analyze.manualEntry.tickerPlaceholder}
                aria-label={dict.analyze.manualEntry.tickerPlaceholder}
                onChange={(e) =>
                  updateRow(row.id, { ticker: e.target.value.toUpperCase() })
                }
                className="w-24 rounded-md border bg-surface px-2 py-1.5 font-mono text-sm uppercase"
                style={{
                  borderColor: tickerInvalid ? "var(--alert)" : "var(--border)",
                }}
              />
              <input
                value={row.weight}
                inputMode="decimal"
                placeholder={dict.analyze.manualEntry.amountPlaceholder}
                aria-label={dict.analyze.manualEntry.amountPlaceholder}
                onChange={(e) => updateRow(row.id, { weight: e.target.value })}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                aria-label={dict.analyze.manualEntry.removePosition}
                className="rounded-md px-2 py-1 text-faint transition-colors hover:text-alert disabled:opacity-30"
              >
                ×
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addRow}
          disabled={atLimit}
          className="w-fit text-sm font-medium text-soft hover:underline disabled:opacity-40"
        >
          {dict.analyze.manualEntry.addPosition}
        </button>

        {hasInvalidTicker && (
          <p className="text-xs text-alert">{dict.analyze.manualEntry.invalidTicker}</p>
        )}
        {!hasInvalidTicker && hasInvalidWeight && (
          <p className="text-xs text-alert">{dict.analyze.manualEntry.invalidWeight}</p>
        )}
        {atLimit && (
          <p className="text-xs text-muted">
            {dict.analyze.manualEntry.limitReached(MAX_PORTFOLIO_TICKERS)}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
          >
            {dict.analyze.manualEntry.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
