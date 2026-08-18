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

export interface UsePaperDepotOptions {
  /** Beispieldepot-Modus (DepotProvider): startet mit diesem Zustand
   * statt aus localStorage zu lesen. Referenz muss über die Lebensdauer
   * der Komponente stabil bleiben (useRef beim Aufrufer) — sie wird nur
   * beim allerersten Render als Startwert verwendet. */
  initialDepot?: DepotState;
  /** false unterdrückt jedes writeDepot() (Beispieldepot-Modus: rein
   * clientseitig, darf das echte localStorage-Depot nie berühren).
   * Default true. */
  persist?: boolean;
  /** Schaltet die paper/valuation-Query hart aus, auch wenn ein Depot
   * geladen ist — verhindert unnötige Backend-/yfinance-Calls für eine
   * Depot-Instanz, die gerade nicht aktiv angezeigt wird (z. B. das
   * Beispieldepot, solange der Nutzer im echten Depot ist, oder
   * umgekehrt). Default true. */
  queryEnabled?: boolean;
}

export function usePaperDepot(
  options: UsePaperDepotOptions = {},
): UsePaperDepotResult {
  const { initialDepot, persist = true, queryEnabled = true } = options;

  // SSR-Gotcha (FRONTEND_DECISIONS §2): mit null initialisieren und erst
  // im useEffect lesen, sonst Hydration-Mismatch zwischen Server- und
  // Client-Render, da localStorage nur im Browser existiert. Ausnahme:
  // initialDepot (Beispieldepot) ist bereits synchron vorhanden, kein
  // localStorage-Zugriff nötig oder gewünscht.
  const [depot, setDepot] = useState<DepotState | null>(
    () => initialDepot ?? null,
  );

  useEffect(() => {
    if (initialDepot) return;
    // Bewusste Ausnahme von der Regel: kein Props/State-Mirroring,
    // sondern der einmalige, SSR-sichere Ladevorgang aus localStorage
    // (s. Kommentar oben) — genau der Fall, für den der Effect da ist.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDepot(readDepot());
  }, [initialDepot]);

  const addTransaction = useCallback(
    (transaction: TransactionIO) => {
      setDepot((prev) => {
        const base = prev ?? createEmptyDepot();
        const next: DepotState = {
          ...base,
          transactions: [...base.transactions, transaction],
        };
        if (persist) writeDepot(next);
        return next;
      });
    },
    [persist],
  );

  const resetDepot = useCallback(() => {
    // Im Beispieldepot-Modus setzt Reset auf den ursprünglichen
    // Beispiel-Bestand zurück (nicht auf ein leeres Depot) — sinnvoller
    // für "zurück zum Ausgangszustand der Demo".
    const next = initialDepot ?? createEmptyDepot();
    if (persist) writeDepot(next);
    setDepot(next);
  }, [initialDepot, persist]);

  // Dependent Query (FRONTEND_DECISIONS §4): läuft erst, sobald das
  // Depot geladen ist UND queryEnabled true ist; ein addTransaction
  // ändert den Query-Key und löst automatisch eine neue Valuation aus.
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
    enabled: depot !== null && queryEnabled,
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
