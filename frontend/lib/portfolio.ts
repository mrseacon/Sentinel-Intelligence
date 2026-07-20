/**
 * Leitet Portfolio-Gewichte aus den aktuellen Depot-Positionen ab
 * (FRONTEND_DECISIONS.md §4: das Portfolio ist abgeleitet, nie eigener
 * State) und liefert den kanonischen Query-Key-Baustein dafür (§1:
 * identisches Portfolio -> identischer Cache-Eintrag, damit Ampel-,
 * Stress- und Simulations-View sich einen einzigen yfinance-Call
 * teilen). Kein React-Import — reine Ableitungslogik.
 */

import type { PositionValueOut } from "./types";

/** Beliebige Skala erlaubt (PortfolioIn-Vertrag, §1.5) — die API
 * renormalisiert; hier reicht der Marktwert je Ticker. */
export function derivePortfolioWeights(
  positions: PositionValueOut[],
): Record<string, number> {
  return Object.fromEntries(positions.map((p) => [p.ticker, p.market_value]));
}

/** Sortierte Gewichts-Einträge als JSON-String — deterministisch
 * unabhängig von der Positions-Reihenfolge in `positions`. */
export function canonicalWeights(weights: Record<string, number>): string {
  const sorted = Object.entries(weights).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(sorted);
}
