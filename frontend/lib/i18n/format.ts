/**
 * Locale-abhängige Zahlen-/Datumsformatierung (I18N_DECISIONS.md §5).
 * Währung bleibt IMMER Euro (das Produkt selbst ist nicht multi-currency,
 * nur die UI-Sprache wechselt) — nur Position/Trennzeichen ändern sich
 * zwischen "1.234,56 €" (de-DE) und "€1,234.56" (en-US).
 */
import type { Locale } from "./config";

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-US" };

export function formatCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatPercent(fraction: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction);
}

export function formatDecimal(value: number, locale: Locale, digits = 2): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** "2007-10-09" -> "09.10.2007" (de) / "10/09/2007" (en). Manuelles
 * Parsing statt `Date`, damit keine Zeitzonen-Verschiebung um einen Tag
 * entsteht (bestehende Konvention aus StressView.tsx). */
export function formatIsoDate(isoDate: string, locale: Locale): string {
  const [year, month, day] = isoDate.split("-");
  return locale === "de" ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
}

export function formatClockTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
