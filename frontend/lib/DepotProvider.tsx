"use client";

/**
 * Hauchdünner Context (FRONTEND_DECISIONS.md §2): verteilt EINE
 * usePaperDepot-Instanz an den (learn)-Bereich. Ohne Context hätten
 * Depot-, Ampel-, Stress- und Simulations-Seite je eigene, desynchrone
 * Hook-Instanzen (eigener localStorage-Read, eigene Valuation-Query).
 *
 * Beispieldepot-Modus ("Beispieldepot ansehen" auf der Landing-Page,
 * Ticket: Demo-Depot): zwei usePaperDepot()-Instanzen laufen parallel
 * (Rules-of-Hooks-sicher — kein bedingter Hook-Aufruf), der Context
 * gibt einfach die Ergebnisse der gerade AKTIVEN Instanz weiter, plus
 * isDemoMode/enterDemoMode/exitDemoMode fürs Banner. Die Beispiel-
 * Instanz bekommt `persist: false` — sie ruft nie readDepot()/
 * writeDepot() auf, kann das echte localStorage-Depot also strukturell
 * nicht berühren (nicht nur "vorsichtig vermieden").
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createDemoDepot } from "./demo-depot";
import type { DepotState } from "./depot-storage";
import { usePaperDepot, type UsePaperDepotResult } from "./usePaperDepot";

export interface DepotContextValue extends UsePaperDepotResult {
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const DepotContext = createContext<DepotContextValue | null>(null);

export function DepotProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Echtes Depot: unverändertes Verhalten ggü. vorher, außer dass seine
  // Valuation-Query pausiert, solange die Demo aktiv ist (spart einen
  // unnötigen paper/valuation-Call, während gerade das Beispieldepot
  // gezeigt wird — ARCHITECTURE §8: yfinance-Ausgangs-IP schonen).
  const real = usePaperDepot({ queryEnabled: !isDemoMode });

  // Beispieldepot: einmal pro Sitzung erzeugt (useState-Lazy-Initializer
  // statt useRef — vom react-hooks/refs-Lint verboten, ref.current
  // während des Renders zu lesen; useState läuft ebenso nur beim
  // allerersten Render), nicht bei jedem enterDemoMode()-Aufruf neu,
  // damit ein erneutes Aufrufen nicht versehentlich zwischenzeitliche
  // Klicks im Beispieldepot verwirft. Query läuft nur, während die Demo
  // aktiv ist.
  const [demoDepotSeed] = useState<DepotState>(() => createDemoDepot());
  const demo = usePaperDepot({
    initialDepot: demoDepotSeed,
    persist: false,
    queryEnabled: isDemoMode,
  });

  // Einstieg über Link von der Landing-Page (/depot?demo=1) — reiner
  // window.location-Read im Effect statt next/navigation's
  // useSearchParams(), damit /depot & Co. weiterhin statisch
  // vorgerendert werden (useSearchParams würde den Client-Baum bis zum
  // nächsten Suspense aus der Prerender-Optimierung nehmen, s.
  // node_modules/next/dist/docs/.../use-search-params.md "Prerendering").
  // Gleiches SSR-sicheres Muster wie usePaperDepot's readDepot()-Effect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDemoMode(true);
    }
  }, []);

  const enterDemoMode = useCallback(() => setIsDemoMode(true), []);
  const exitDemoMode = useCallback(() => setIsDemoMode(false), []);

  const active = isDemoMode ? demo : real;

  const value = useMemo<DepotContextValue>(
    () => ({ ...active, isDemoMode, enterDemoMode, exitDemoMode }),
    [active, isDemoMode, enterDemoMode, exitDemoMode],
  );

  return (
    <DepotContext.Provider value={value}>{children}</DepotContext.Provider>
  );
}

export function useDepot(): DepotContextValue {
  const ctx = useContext(DepotContext);
  if (!ctx) {
    throw new Error(
      "useDepot() muss innerhalb von <DepotProvider> aufgerufen werden.",
    );
  }
  return ctx;
}
