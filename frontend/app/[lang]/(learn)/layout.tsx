import { Disclaimer } from "@/components/Disclaimer";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Nav } from "@/components/Nav";
import { DepotProvider } from "@/lib/DepotProvider";
import { LocaleLink } from "@/lib/i18n/link";

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
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
            <LocaleLink
              href="/"
              className="font-serif text-xl tracking-[0.1em] uppercase"
            >
              Sentinel<span className="text-accent">.</span>
            </LocaleLink>
            <div className="flex items-center gap-3">
              <Nav />
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          {children}
        </div>
        <footer className="border-t border-border">
          <Disclaimer />
        </footer>
      </div>
    </DepotProvider>
  );
}
