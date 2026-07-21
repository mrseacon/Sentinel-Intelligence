"use client";

// Zwei gleichwertige, nebeneinander stehende Eingabewege für ein freies
// Portfolio (FRONTEND_DECISIONS §8/ARCHITECTURE §6): CSV-Upload und
// manuelle Ticker/Betrag-Paare. Beide melden ein fertiges PortfolioIn
// über onPortfolioReady — die Analyse-Logik lebt in AnalyzeView, nicht
// hier.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { ApiError, postPortfolioUpload } from "@/lib/api";
import { isValidTicker, MAX_CSV_BYTES, MAX_PORTFOLIO_TICKERS } from "@/lib/limits";
import { POPULAR_TICKERS } from "@/lib/popular-tickers";
import type { PortfolioIn } from "@/lib/types";

interface PortfolioBuilderProps {
  onPortfolioReady: (portfolio: PortfolioIn) => void;
}

export function PortfolioBuilder({ onPortfolioReady }: PortfolioBuilderProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <CsvUploadCard onPortfolioReady={onPortfolioReady} />
      <ManualEntryCard onPortfolioReady={onPortfolioReady} />
    </div>
  );
}

function CsvUploadCard({ onPortfolioReady }: PortfolioBuilderProps) {
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
      setClientError("Nur .csv-Dateien werden unterstützt.");
      return;
    }
    if (selected.size > MAX_CSV_BYTES) {
      setClientError(
        `Datei ist ${(selected.size / 1_000_000).toFixed(1)} MB groß, ` +
          `maximal ${MAX_CSV_BYTES / 1_000_000} MB.`,
      );
      return;
    }
    setFile(selected);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="font-semibold">CSV-Upload</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Spalten <code>ticker</code> und <code>weight</code>, beliebige
        positive Skala (z.&nbsp;B. Euro-Beträge oder Stückzahlen).
      </p>
      {/* Nativer file-selector-button rendert plattformabhängig sehr
          inkonsistent (Preflight setzt ihn u.a. auf Breite/Padding 0
          zurück). Robusteres Muster: Input visuell verstecken (sr-only,
          bleibt fokussier-/tastaturbedienbar), ein <label> triggert es. */}
      <label
        htmlFor="csv-upload-input"
        className="mt-3 inline-block cursor-pointer rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Datei auswählen
      </label>
      <input
        id="csv-upload-input"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="sr-only"
      />

      {clientError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {clientError}
        </p>
      )}

      {file && !clientError && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {file.name} ({(file.size / 1000).toFixed(0)} KB)
        </p>
      )}

      {file && !clientError && (
        <button
          type="button"
          onClick={() => uploadMutation.mutate(file)}
          disabled={uploadMutation.isPending}
          className="mt-3 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          {uploadMutation.isPending ? "Wird hochgeladen…" : "Hochladen"}
        </button>
      )}

      {uploadMutation.error instanceof ApiError && (
        <div className="mt-3">
          <ErrorNotice error={uploadMutation.error} />
        </div>
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
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Manuelle Eingabe</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filledRows.length} von {MAX_PORTFOLIO_TICKERS}
        </span>
      </div>

      <div className="mt-3">
        <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Beliebte Werte
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {POPULAR_TICKERS.map((popular) => (
            <button
              key={popular.ticker}
              type="button"
              disabled={atLimit}
              aria-label={`${popular.name} hinzufügen`}
              onClick={() => addPopular(popular.ticker)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              {popular.name}{" "}
              <span className="text-slate-400 dark:text-slate-500">
                {popular.ticker}
              </span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        {rows.map((row) => {
          const trimmed = row.ticker.trim().toUpperCase();
          const tickerInvalid = trimmed.length > 0 && !isValidTicker(trimmed);
          return (
            <div key={row.id} className="flex items-center gap-2">
              <input
                value={row.ticker}
                maxLength={15}
                placeholder="Ticker"
                aria-label="Ticker"
                onChange={(e) =>
                  updateRow(row.id, { ticker: e.target.value.toUpperCase() })
                }
                className={`w-24 rounded-md border px-2 py-1 text-sm uppercase dark:bg-slate-900 ${
                  tickerInvalid
                    ? "border-red-400 dark:border-red-700"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              />
              <input
                value={row.weight}
                inputMode="decimal"
                placeholder="Betrag"
                aria-label="Betrag"
                onChange={(e) => updateRow(row.id, { weight: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                aria-label="Position entfernen"
                className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-slate-800"
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
          className="text-sm font-medium text-slate-600 hover:underline disabled:opacity-40 dark:text-slate-300"
        >
          + Position hinzufügen
        </button>

        {hasInvalidTicker && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Mindestens ein Ticker hat ein ungültiges Format (Großbuchstaben,
            Ziffern, . - ^ =, max. 15 Zeichen).
          </p>
        )}
        {!hasInvalidTicker && hasInvalidWeight && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Beträge müssen positive Zahlen sein.
          </p>
        )}
        {atLimit && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Maximal {MAX_PORTFOLIO_TICKERS} Positionen erreicht.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            Portfolio analysieren
          </button>
        </div>
      </form>
    </div>
  );
}
