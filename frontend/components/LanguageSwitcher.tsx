"use client";

// Sprachumschalter (I18N_DECISIONS.md §4/§6/§7): setzt einen langlebigen
// Cookie (schlägt ab jetzt jede künftige Accept-Language-Erkennung in
// proxy.ts) und navigiert auf denselben Pfad unter dem anderen
// Locale-Präfix. Nutzt bewusst next/link DIREKT statt LocaleLink — der
// Ziel-Locale ist hier explizit die ANDERE Sprache, nicht die aktuelle,
// die LocaleLink automatisch anhängen würde.
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function LanguageSwitcher() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();

  return (
    <div className="flex gap-1 text-xs font-medium">
      {LOCALES.map((candidate) => (
        <Link
          key={candidate}
          href={pathWithLocale(pathname, candidate)}
          onClick={() => persistLocaleChoice(candidate)}
          aria-current={candidate === locale ? "true" : undefined}
          aria-label={
            candidate === "de"
              ? dict.languageSwitcher.switchToGerman
              : dict.languageSwitcher.switchToEnglish
          }
          className={`rounded-md px-2 py-1 uppercase ${
            candidate === locale
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {candidate}
        </Link>
      ))}
    </div>
  );
}
