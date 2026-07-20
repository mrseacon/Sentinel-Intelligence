/**
 * Kuratierte Ticker-Vorschlagsliste fürs Trade-Formular (Einsteiger
 * kennen oft keine Kürzel). Reine statische Daten, kein React-Import —
 * kein Backend-Endpunkt nötig (ARCHITECTURE.md §1: Bildung zuerst).
 *
 * Bewusst inkl. 3 nicht-US-Werte mit Yahoo-Notation (SAP.DE, SIE.DE,
 * MC.PA), damit sichtbar wird, dass auch europäische Ticker über den
 * Suffix funktionieren (vgl. Loader-Fehlermeldung/TICKER_PATTERN,
 * lib/limits.ts).
 */

export interface PopularTicker {
  ticker: string;
  name: string;
}

export const POPULAR_TICKERS: PopularTicker[] = [
  { ticker: "AAPL", name: "Apple" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "GOOGL", name: "Alphabet" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "META", name: "Meta" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "NFLX", name: "Netflix" },
  { ticker: "AMD", name: "AMD" },
  { ticker: "BRK-B", name: "Berkshire Hathaway" },
  { ticker: "JPM", name: "JPMorgan Chase" },
  { ticker: "V", name: "Visa" },
  { ticker: "SAP.DE", name: "SAP" },
  { ticker: "SIE.DE", name: "Siemens" },
  { ticker: "MC.PA", name: "LVMH" },
];
