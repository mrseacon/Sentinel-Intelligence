/**
 * UI-seitiger Spiegel von backend/src/sentinel_api/limits.py
 * (FRONTEND_DECISIONS.md §8). Wer eine Seite ändert, ändert die andere.
 *
 * Diese Grenzen sind reine UX: Sie verhindern, dass ein Nutzer einen
 * Request abschickt, der ohnehin serverseitig abgelehnt würde. Die
 * eigentliche Verteidigung bleibt das Backend (das UI ist umgehbar).
 */

/** Max. Ticker pro Portfolio-/Optimizer-Request. */
export const MAX_PORTFOLIO_TICKERS = 50;

/** Max. Transaktionen pro paper/*-Request (Depot-Historie). */
export const MAX_TRANSACTIONS = 10_000;

/** Ab dieser Transaktionsanzahl zeigt das Depot einen Warnhinweis
 * (praktisch unerreichbar, aber der Zustand darf nie kommentarlos
 * kaputtgehen). */
export const TRANSACTIONS_WARNING_THRESHOLD = 9_500;

/** Globale Body-Grenze (413 PAYLOAD_TOO_LARGE), in Bytes. */
export const MAX_BODY_BYTES = 2_000_000;

/** CSV-Upload-Grenze, in Bytes — clientseitig vor dem Upload geprüft. */
export const MAX_CSV_BYTES = 1_000_000;

/** Outbound-Ticker-Allowlist, identisch zu sentinel_core/data/loader.py
 * TICKER_PATTERN. Deckt alle genutzten Yahoo-Notationen ab (BMW.DE,
 * BRK-B, ^GSPC, EURUSD=X). */
export const TICKER_PATTERN = /^[A-Z0-9.\-^=]{1,15}$/;

export function isValidTicker(ticker: string): boolean {
  return TICKER_PATTERN.test(ticker);
}
