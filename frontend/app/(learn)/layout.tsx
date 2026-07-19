import Link from "next/link";

import { Disclaimer } from "@/components/Disclaimer";
import { Nav } from "@/components/Nav";
import { DepotProvider } from "@/lib/DepotProvider";

// Gemeinsames Layout für den Lern-Bereich (FRONTEND_DECISIONS.md §7):
// Navigation + fester Disclaimer-Footer + DepotProvider. Der
// (learn)-Bereich ist genau der Geltungsbereich des Depots (Depot,
// Ampel, Stress, Simulation teilen sich EINE Hook-Instanz) — analyze/
// bleibt bewusst außerhalb (§4: eigener, getrennter Portfolio-Slot).
export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DepotProvider>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-sm font-semibold">
              Sentinel
            </Link>
            <Nav />
          </div>
        </header>
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          {children}
        </div>
        <footer className="border-t border-slate-200 dark:border-slate-800">
          <Disclaimer />
        </footer>
      </div>
    </DepotProvider>
  );
}
