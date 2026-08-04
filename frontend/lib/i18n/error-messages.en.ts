/**
 * Core-Fehlermeldungen auf Englisch, gemappt über den stabilen `code`
 * (I18N_DECISIONS.md §3) — nicht über das deutsche `detail`, das bleibt
 * backend-seitig unangetastet (Phase-2-Frage). Jeder Code aus
 * `backend/src/sentinel_api/errors.py` (ERROR_CODE_REGISTRY, FALLBACK_CODE,
 * die drei Handler-Literale) plus `PAYLOAD_TOO_LARGE` aus `main.py` MUSS
 * hier einen Eintrag haben — durchgesetzt vom Vollständigkeitstest in
 * `error-messages.test.ts`, der die Codes direkt aus den Backend-Dateien
 * ausliest statt eine zweite, von Hand gepflegte Liste zu duplizieren.
 */

export const ERROR_MESSAGES_EN: Record<string, string> = {
  TICKER_NOT_FOUND: "Ticker symbol not found.",
  PORTFOLIO_INVALID: "This portfolio is not valid.",
  PAPER_INSUFFICIENT_CASH: "Not enough cash for this purchase.",
  PAPER_INSUFFICIENT_HOLDINGS: "Not enough shares held for this sale.",
  PAPER_FEE_NOT_COVERED: "Sale proceeds don't cover the trading fee.",
  PAPER_INVALID_QUANTITY: "Quantity must be a positive whole number.",
  LEDGER_INCONSISTENT: "Inconsistent transaction history.",
  STRESS_UNKNOWN_PRESET: "Unknown crisis scenario.",
  STRESS_INSUFFICIENT_COVERAGE:
    "Not enough of your portfolio existed during this period for a meaningful result.",
  SIM_HORIZON_INVALID: "Invalid time horizon.",
  SIM_INSUFFICIENT_HISTORY: "Not enough price history for this simulation.",
  OPTIMIZER_NO_CONVERGENCE: "The optimizer did not converge.",
  OPTIMIZER_INVALID_INPUT: "Invalid input for the optimizer.",
  CORRELATION_INVALID_INPUT: "The correlation matrix needs at least 2 assets.",
  UPLOAD_INVALID: "This file could not be read as a valid portfolio.",
  TICKER_INVALID: "Invalid ticker symbol.",
  BENCHMARK_UNKNOWN: "Unknown benchmark index.",
  VALIDATION_ERROR: "Invalid input.",
  UPSTREAM_UNAVAILABLE: "Price data source is currently unavailable. Please try again later.",
  INTERNAL_ERROR: "Internal server error. Please try again later.",
  PAYLOAD_TOO_LARGE: "This request is too large.",
  // FALLBACK_CODE in errors.py — auch der generische Rückfall für jeden
  // Code, den diese Tabelle (noch) nicht kennt, s. englishErrorMessage().
  DOMAIN_ERROR: "Something went wrong. Please try again.",
};

export function englishErrorMessage(code: string): string {
  return ERROR_MESSAGES_EN[code] ?? ERROR_MESSAGES_EN.DOMAIN_ERROR;
}
