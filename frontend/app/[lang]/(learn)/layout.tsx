import { DemoModeBanner } from "@/components/DemoModeBanner";
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
        {/* Rendert sich selbst weg außerhalb des Beispieldepot-Modus
            (DemoModeBanner liest isDemoMode aus demselben Context). */}
        <DemoModeBanner />
        <header className="border-b border-border">
          {/* Mobil: Logo + Sprachumschalter in Zeile 1, Navigation volle
              Breite in Zeile 2 (sonst ist der Header breiter als der
              Viewport und die ganze Seite scrollt seitlich). Ab sm wie
              gehabt alles in einer Zeile; `order` sortiert nur visuell um. */}
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <LocaleLink
              href="/"
              className="font-serif text-xl tracking-[0.1em] uppercase"
            >
              Sentinel<span className="text-accent">.</span>
            </LocaleLink>
            <div className="order-3 w-full min-w-0 sm:order-2 sm:ml-auto sm:w-auto">
              <Nav />
            </div>
            <div className="ml-auto sm:order-3 sm:ml-0">
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
