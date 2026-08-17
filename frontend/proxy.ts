/**
 * Locale-Erkennung + Redirect (I18N_DECISIONS.md §4/§6). Next.js 16 hat
 * die Datei-Konvention von `middleware.ts` zu `proxy.ts` umbenannt
 * (Funktion `middleware()` -> `proxy()`) — dieser Datei- und Funktionsname
 * ist für diese installierte Version absichtlich korrekt, nicht der alte.
 *
 * Reihenfolge: Pfad hat schon ein Locale-Präfix -> nichts tun. Sonst:
 * Cookie (bewusste, frühere Umschaltung) schlägt Accept-Language, das
 * wiederum schlägt Deutsch als Fallback (§6 — Kernzielgruppe bleibt
 * Deutsch, Erkennung ist nur die Erstbesuchs-Komfortfunktion).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    (cookieLocale && isLocale(cookieLocale) ? cookieLocale : undefined) ??
    detectFromAcceptLanguage(request) ??
    DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

function detectFromAcceptLanguage(request: NextRequest): string | undefined {
  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return undefined;

  const negotiator = new Negotiator({
    headers: { "accept-language": acceptLanguage },
  });
  try {
    return match(negotiator.languages(), LOCALES, DEFAULT_LOCALE);
  } catch {
    // Graceful Degradation (I18N_DECISIONS §6): ein kaputter/leerer
    // Accept-Language-Header darf nie einen Absturz auslösen, nur den
    // Fallback auf DEFAULT_LOCALE bewirken (via `undefined` hier).
    return undefined;
  }
}

export const config = {
  // Assets/Metadaten aussparen, sonst blockiert der Redirect CSS/JS/Bilder
  // und die eigenständigen Metadata-Routen (SEO-Redesign: sitemap.xml,
  // robots.txt, opengraph-image, twitter-image landen sonst unter
  // /de/sitemap.xml etc. und 404en, weil es dort keine passende Route gibt).
  matcher: [
    "/((?!_next|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|opengraph-image|twitter-image).*)",
  ],
};
