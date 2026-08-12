"use client";

// usePathname braucht den Browser-Router-Zustand -> Client-Komponente.
// Der Rest der App bleibt so weit wie möglich serverseitig gerendert.
import { usePathname } from "next/navigation";

import { LocaleLink } from "@/lib/i18n/link";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function Nav() {
  const pathname = usePathname();
  const { dict } = useI18n();

  const LINKS = [
    { href: "/depot", label: dict.nav.depot },
    { href: "/ampel", label: dict.nav.ampel },
    { href: "/stress", label: dict.nav.stress },
    { href: "/simulation", label: dict.nav.simulation },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        // pathname enthält das Locale-Präfix (z.B. "/en/depot") -> Vergleich
        // muss das Suffix prüfen, nicht auf exakte Gleichheit mit href.
        const isActive = pathname.endsWith(href);
        return (
          <LocaleLink
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap no-underline transition-colors ${
              isActive ? "bg-ink text-bg" : "text-soft hover:bg-sunken"
            }`}
          >
            {label}
          </LocaleLink>
        );
      })}
    </nav>
  );
}
