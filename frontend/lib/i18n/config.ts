/**
 * Zentrale i18n-Konstanten (I18N_DECISIONS.md §1/§4/§6). Einzige Quelle
 * für die unterstützten Sprachen — `proxy.ts`, die Dictionary-Loader und
 * der Sprachumschalter importieren ausschließlich von hier.
 */

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_COOKIE = "sentinel_locale";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
