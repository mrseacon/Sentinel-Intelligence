/**
 * Server-seitiger Dictionary-Loader (I18N_DECISIONS.md §1, Next.js'
 * eigenes App-Router-Muster). Nur aus Server-Komponenten importieren
 * (page.tsx/layout.tsx) — Client-Komponenten bekommen das bereits
 * geladene Dictionary über I18nProvider/useI18n, nie direkt von hier.
 */
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/de";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  de: () => import("./dictionaries/de").then((m) => m.default),
  en: () => import("./dictionaries/en").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
