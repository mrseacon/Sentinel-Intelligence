/**
 * Fest vorgegebenes Beispieldepot für den "Beispieldepot ansehen"-Modus
 * (DepotProvider). Bewusst NICHT perfekt diversifiziert: AAPL/MSFT/NVDA
 * bilden einen korrelierten Tech-Klumpen (~70 % der Positionen), JNJ/KO
 * sind das defensive Gegengewicht — Ampel (Klumpenrisiko) und die
 * Korrelationsmatrix haben damit etwas zu zeigen statt nur Grün.
 *
 * Kauf-Kurse/-Zeitpunkte sind reine Anzeigewerte ("Kurs von HH:MM" in
 * der Positionstabelle) — die tatsächliche Bewertung (current_price,
 * market_value) kommt wie beim echten Depot live von POST
 * /paper/valuation (ARCHITECTURE §3: Backend bleibt einzige Quelle der
 * Wahrheit für Positionsberechnung, hier wie überall).
 */

import {
  CURRENT_SCHEMA_VERSION,
  PAPER_START_CASH,
  type DepotState,
} from "./depot-storage";
import type { PaperAccountIn, TransactionIO } from "./types";

const TRADE_FEE = 1;

interface DemoPosition {
  ticker: string;
  quantity: number;
  price: number;
  daysAgo: number;
}

// Älteste Position zuerst — erzählt "über ~5 Wochen aufgebaut", nicht
// alles am selben Tag gekauft.
const DEMO_POSITIONS: DemoPosition[] = [
  { ticker: "AAPL", quantity: 15, price: 220, daysAgo: 35 },
  { ticker: "MSFT", quantity: 4, price: 420, daysAgo: 28 },
  { ticker: "NVDA", quantity: 10, price: 130, daysAgo: 21 },
  { ticker: "JNJ", quantity: 8, price: 155, daysAgo: 14 },
  { ticker: "KO", quantity: 16, price: 65, daysAgo: 7 },
];

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

/** Erzeugt einen frischen Beispieldepot-Zustand — jeder Aufruf bekommt
 * eigene IDs/Zeitstempel, damit zwei Demo-Sitzungen sich nie eine
 * Transaktions-Identität teilen. */
export function createDemoDepot(): DepotState {
  const account: PaperAccountIn = {
    id: crypto.randomUUID(),
    name: "Beispieldepot",
    start_cash: PAPER_START_CASH,
    created_at: daysAgoIso(DEMO_POSITIONS[0].daysAgo),
  };

  const transactions: TransactionIO[] = DEMO_POSITIONS.map((position) => {
    const executedAt = daysAgoIso(position.daysAgo);
    return {
      id: crypto.randomUUID(),
      account_id: account.id,
      ticker: position.ticker,
      side: "BUY",
      quantity: position.quantity,
      price: position.price,
      price_asof: executedAt,
      fees: TRADE_FEE,
      executed_at: executedAt,
    };
  });

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    account,
    transactions,
  };
}
