"use client";

/**
 * DER eine State-Besitzer für das Paper-Depot (FRONTEND_DECISIONS.md §2).
 * Hält den Depot-Zustand in useState, synchronisiert bei jeder Änderung
 * nach localStorage und leitet Positionen/Depotwert vom Backend ab
 * (§4: paper/valuation bleibt einzige Quelle der Wahrheit — kein
 * eigener Positions-Code im Frontend, ARCHITECTURE.md §3).
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { ApiError, postPaperValuation } from "./api";
import {
  createEmptyDepot,
  readDepot,
  writeDepot,
  type DepotState,
} from "./depot-storage";
import type { AccountValuationOut, TransactionIO } from "./types";

export interface UsePaperDepotResult {
  /** null solange der Depot-Zustand noch nicht aus localStorage gelesen
   * wurde (SSR-sicher: kein window-Zugriff beim ersten Render). */
  depot: DepotState | null;
  /** Hängt eine neue Transaktion an und persistiert synchron. */
  addTransaction: (transaction: TransactionIO) => void;
  /** Setzt das Depot auf ein frisches Konto mit Startkapital zurück. */
  resetDepot: () => void;
  valuation: AccountValuationOut | undefined;
  isValuationLoading: boolean;
  valuationError: ApiError | null;
}

export function usePaperDepot(): UsePaperDepotResult {
  // SSR-Gotcha (FRONTEND_DECISIONS §2): mit null initialisieren und erst
  // im useEffect lesen, sonst Hydration-Mismatch zwischen Server- und
  // Client-Render, da localStorage nur im Browser existiert.
  const [depot, setDepot] = useState<DepotState | null>(null);

  useEffect(() => {
    setDepot(readDepot());
  }, []);

  const addTransaction = useCallback((transaction: TransactionIO) => {
    setDepot((prev) => {
      const base = prev ?? createEmptyDepot();
      const next: DepotState = {
        ...base,
        transactions: [...base.transactions, transaction],
      };
      writeDepot(next);
      return next;
    });
  }, []);

  const resetDepot = useCallback(() => {
    const next = createEmptyDepot();
    writeDepot(next);
    setDepot(next);
  }, []);

  // Dependent Query (FRONTEND_DECISIONS §4): läuft erst, sobald das
  // Depot aus localStorage geladen ist; ein addTransaction ändert den
  // Query-Key und löst automatisch eine neue Valuation aus.
  const {
    data: valuation,
    isPending: isValuationLoading,
    error,
  } = useQuery({
    queryKey: [
      "paper",
      "valuation",
      depot?.account.id,
      depot?.transactions,
    ],
    queryFn: () =>
      postPaperValuation({
        account: depot!.account,
        transactions: depot!.transactions,
      }),
    enabled: depot !== null,
  });

  return {
    depot,
    addTransaction,
    resetDepot,
    valuation,
    isValuationLoading,
    valuationError: error instanceof ApiError ? error : null,
  };
}
