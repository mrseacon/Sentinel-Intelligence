"use client";

// Sprachumschalter (I18N_DECISIONS.md §4/§6/§7): setzt einen langlebigen
// Cookie (schlägt ab jetzt jede künftige Accept-Language-Erkennung in
// proxy.ts) und navigiert auf denselben Pfad unter dem anderen
// Locale-Präfix. Nutzt bewusst next/link DIREKT statt LocaleLink — der
// Ziel-Locale ist hier explizit die ANDERE Sprache, nicht die aktuelle,
// die LocaleLink automatisch anhängen würde.
//
// Der Beispieldepot-Modus überlebt den Wechsel: Der Query-String (z. B.
// ?demo=1) wird mitgenommen, und ein per Klick betretener Demo-Modus wird
// als ?demo=1 ergänzt — sonst landete man nach dem Wechsel im (leeren)
// echten Depot, weil der [lang]-Baum samt DepotProvider neu mountet.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import { useIsDemoMode } from "@/lib/DepotProvider";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 Jahr (§6)

function pathWithLocale(pathname: string, targetLocale: Locale): string {
  const segments = pathname.split("/");
  // segments[0] ist "" (führender Slash), segments[1] das aktuelle Locale.
  segments[1] = targetLocale;
  return segments.join("/") || "/";
}

// Modulebene statt Closure in der Komponente: reiner Seiteneffekt ohne
// Bezug zu Komponenten-State, den ein Klick auslöst — keine Ableitung,
// die der React Compiler tracken müsste.
function persistLocaleChoice(target: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

// Query-String erst beim Klick aus window.location lesen statt über
// useSearchParams(): Letzteres würde die statisch vorgerenderten Seiten
// in eine Suspense-Grenze zwingen (gleiches Muster wie DepotProvider).
function targetSearch(isDemoMode: boolean): string {
  const params = new URLSearchParams(window.location.search);
  if (isDemoMode) {
    params.set("demo", "1");
  } else {
    params.delete("demo");
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const isDemoMode = useIsDemoMode();
  const { locale, dict } = useI18n();

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>,
    candidate: Locale,
    href: string,
  ) {
    persistLocaleChoice(candidate);
    // Modifier-Klicks (neuer Tab o. ä.) dem Browser überlassen.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const search = targetSearch(isDemoMode);
    if (!search) return; // Link navigiert selbst
    event.preventDefault();
    router.push(`${href}${search}`);
  }

  return (
    <div className="flex gap-1 text-xs font-medium">
      {LOCALES.map((candidate) => {
        const href = pathWithLocale(pathname, candidate);
        return (
          <Link
            key={candidate}
            href={href}
            onClick={(event) => handleClick(event, candidate, href)}
            aria-current={candidate === locale ? "true" : undefined}
            aria-label={
              candidate === "de"
                ? dict.languageSwitcher.switchToGerman
                : dict.languageSwitcher.switchToEnglish
            }
            className={`rounded-md px-2 py-1 uppercase no-underline transition-colors ${
              candidate === locale
                ? "bg-ink text-bg"
                : "text-muted hover:bg-sunken"
            }`}
          >
            {candidate}
          </Link>
        );
      })}
    </div>
  );
}
