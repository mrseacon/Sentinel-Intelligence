/**
 * Reines Lese/Schreib-Modul für den lokalen Paper-Depot-Zustand
 * (FRONTEND_DECISIONS.md §2). Kein React-Import — reine Datenschicht,
 * unabhängig vom Hook testbar.
 *
 * Schema identisch zum Backend-Modell (ARCHITECTURE.md §4.1/§7): der
 * spätere Import ins Backend (Phase 2) soll reiner Datenimport sein,
 * keine Transformation.
 */

import type { PaperAccountIn, TransactionIO } from "./types";

const STORAGE_KEY = "sentinel_paper_depot";
const CURRENT_SCHEMA_VERSION = 1;

/** Startkapital, identisch zu sentinel_core/constants.py PAPER_START_CASH. */
const PAPER_START_CASH = 10_000;

export interface DepotState {
  schema_version: number;
  account: PaperAccountIn;
  transactions: TransactionIO[];
}

function createDefaultAccount(): PaperAccountIn {
  return {
    id: crypto.randomUUID(),
    name: "Mein Paper-Depot",
    start_cash: PAPER_START_CASH,
    created_at: new Date().toISOString(),
  };
}

/** Leerer, gültiger Depot-Zustand — Rückfallebene für fehlenden oder
 * korrupten localStorage-Inhalt sowie für den ersten Besuch. */
export function createEmptyDepot(): DepotState {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    account: createDefaultAccount(),
    transactions: [],
  };
}

function isPlausibleDepotState(value: unknown): value is DepotState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schema_version === "number" &&
    typeof v.account === "object" &&
    v.account !== null &&
    Array.isArray(v.transactions)
  );
}

/**
 * Migrationstabelle für künftige schema_version-Sprünge (ARCHITECTURE §7).
 * Aktuell existiert nur v1; künftige Versionen bekommen hier je einen
 * eigenen `case`, der auf CURRENT_SCHEMA_VERSION hochzieht.
 */
function migrate(state: DepotState): DepotState {
  switch (state.schema_version) {
    case CURRENT_SCHEMA_VERSION:
      return state;
    default:
      // Unbekannte (zukünftige oder beschädigte) Version — sicherer
      // Fallback statt eines Absturzes oder stillschweigend falscher Daten.
      return createEmptyDepot();
  }
}

/** Liest den Depot-Zustand aus localStorage. Fehlender oder korrupter
 * Inhalt führt IMMER zu einem leeren, gültigen Depot — nie zu einem
 * Crash. Nur im Browser aufrufen (kein window in SSR). */
export function readDepot(): DepotState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyDepot();

    const parsed: unknown = JSON.parse(raw);
    if (!isPlausibleDepotState(parsed)) return createEmptyDepot();

    return migrate(parsed);
  } catch {
    return createEmptyDepot();
  }
}

/** Schreibt den Depot-Zustand synchron nach localStorage. Schreibfehler
 * (Quota, privater Modus) werden verschluckt statt die App abstürzen zu
 * lassen — der In-Memory-State bleibt für die laufende Sitzung die
 * Quelle der Wahrheit. */
export function writeDepot(state: DepotState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // bewusst leer, s. Kommentar oben
  }
}
