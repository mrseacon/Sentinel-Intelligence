"use client";

// EINZIGE Fehlerdarstellung im Projekt (FRONTEND_DECISIONS.md §3) — kein
// ad-hoc alert(), keine verstreuten Fehlertexte. `detail` (in `error.message`,
// da ApiError extends Error) ist bereits serverseitig kuratiertes Deutsch
// und wird auf Deutsch IMMER unverändert angezeigt; nur der `code` steuert
// Ort/Verhalten. Im englischen UI (I18N_DECISIONS.md §3) wird `detail`
// NICHT angezeigt (Sprachmischung wäre schlechter als generisch-englisch)
// — stattdessen die code->Text-Tabelle in error-messages.en.ts, mit
// Vollständigkeitstest gegen die Backend-Registry (error-messages.test.ts).
import type { ApiError } from "@/lib/api";
import { englishErrorMessage } from "@/lib/i18n/error-messages.en";
import { useI18n } from "@/lib/i18n/I18nProvider";

const RETRYABLE_CODES = new Set(["UPSTREAM_UNAVAILABLE", "INTERNAL_ERROR"]);

function resolveVariant(code: string): "banner" | "inline" {
  // Retry sinnvoll + der praktisch unerreichbare PAYLOAD_TOO_LARGE-Fallback
  // laufen als Banner; alles, was der Nutzer selbst beheben kann (falscher
  // Ticker, Validierungsfehler, ...) erscheint inline am auslösenden Formular.
  if (RETRYABLE_CODES.has(code) || code === "PAYLOAD_TOO_LARGE") return "banner";
  return "inline";
}

export interface ErrorNoticeProps {
  error: ApiError;
  onRetry?: () => void;
}

export function ErrorNotice({ error, onRetry }: ErrorNoticeProps) {
  const { dict, locale } = useI18n();
  const variant = resolveVariant(error.code);
  const canRetry = RETRYABLE_CODES.has(error.code) && onRetry !== undefined;
  const message = locale === "de" ? error.message : englishErrorMessage(error.code);

  if (variant === "banner") {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <span>{message}</span>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md border border-red-400 px-3 py-1 font-medium hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900"
          >
            {dict.common.retry}
          </button>
        )}
      </div>
    );
  }

  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}
