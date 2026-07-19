"use client";

/**
 * Hauchdünner Context (FRONTEND_DECISIONS.md §2): verteilt EINE
 * usePaperDepot-Instanz an den (learn)-Bereich. Ohne Context hätten
 * Depot-, Ampel-, Stress- und Simulations-Seite je eigene, desynchrone
 * Hook-Instanzen (eigener localStorage-Read, eigene Valuation-Query).
 */

import { createContext, useContext } from "react";

import { usePaperDepot, type UsePaperDepotResult } from "./usePaperDepot";

const DepotContext = createContext<UsePaperDepotResult | null>(null);

export function DepotProvider({ children }: { children: React.ReactNode }) {
  const depot = usePaperDepot();
  return (
    <DepotContext.Provider value={depot}>{children}</DepotContext.Provider>
  );
}

export function useDepot(): UsePaperDepotResult {
  const ctx = useContext(DepotContext);
  if (!ctx) {
    throw new Error(
      "useDepot() muss innerhalb von <DepotProvider> aufgerufen werden.",
    );
  }
  return ctx;
}
