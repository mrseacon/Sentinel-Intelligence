import Link from "next/link";

import { Disclaimer } from "@/components/Disclaimer";
import { Nav } from "@/components/Nav";

// Gemeinsames Layout für den Lern-Bereich (FRONTEND_DECISIONS.md §7):
// Navigation + fester Disclaimer-Footer. DepotProvider (localStorage-
// Depot-Zustand) kommt in der nächsten Bau-Phase (Bau-Reihenfolge
// Schritt 2) — hier bewusst noch keine Feature-Logik.
export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
