"use client";

// Permanenter Hinweis, solange der Beispieldepot-Modus aktiv ist (Demo-
// Depot-Ticket, Anforderung 3): lebt IN der sticky-Header-Zeile von
// (learn)/layout.tsx, bleibt also beim Scrollen sichtbar wie der Header
// selbst, statt als separater sticky-Layer mit eigenem Zindex-Konflikt.
// Rendert nichts außerhalb des Demo-Modus (useDepot() liefert
// isDemoMode für den gesamten (learn)-Bereich, s. DepotProvider).
import { useDepot } from "@/lib/DepotProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function DemoModeBanner() {
  const { isDemoMode, exitDemoMode } = useDepot();
  const { dict } = useI18n();

  if (!isDemoMode) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 border-b border-warn bg-warn-tint px-4 py-2 text-center text-[13px] font-medium text-warn"
    >
      <span>{dict.demo.bannerText}</span>
      <button
        type="button"
        onClick={exitDemoMode}
        className="shrink-0 rounded-md border border-warn px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:bg-warn/10"
      >
        {dict.demo.exit}
      </button>
    </div>
  );
}
