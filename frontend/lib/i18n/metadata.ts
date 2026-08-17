/**
 * Gemeinsamer Metadata-Baustein fürs SEO-Redesign (siehe Next.js-Doku
 * node_modules/next/dist/docs/.../generate-metadata.md, Abschnitte
 * `alternates` und `openGraph`). `metadataBase` lebt im Root-Layout
 * (app/[lang]/layout.tsx); hier werden nur die relativen Pfade gebaut,
 * die Next.js dagegen auflöst.
 */
import type { Metadata } from "next";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

// Einzige Quelle für die Produktions-URL (Fallback = README "Live Demo").
// Für einen abweichenden Deploy (eigene Domain, Preview-Branch) per
// NEXT_PUBLIC_SITE_URL in den Vercel-Projekteinstellungen überschreiben.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sentinel-intelligence-delta.vercel.app";

export const OG_LOCALE: Record<Locale, string> = {
  de: "de_DE",
  en: "en_US",
};

export function buildPageMetadata({
  lang,
  path,
  title,
  description,
  titleIsAbsolute = false,
}: {
  lang: Locale;
  /** Locale-loser Pfad, z. B. "/ampel"; "" für die Startseite. */
  path: string;
  title: string;
  description: string;
  /** true für die Startseite: kein "%s · Sentinel"-Suffix aus dem Root-Layout-Template. */
  titleIsAbsolute?: boolean;
}): Metadata {
  const languages = Object.fromEntries(
    LOCALES.map((locale) => [locale, `/${locale}${path}`]),
  ) as Record<Locale, string>;

  return {
    title: titleIsAbsolute ? { absolute: title } : title,
    description,
    alternates: {
      canonical: `/${lang}${path}`,
      languages: { ...languages, "x-default": `/${DEFAULT_LOCALE}${path}` },
    },
    openGraph: {
      title,
      description,
      url: `/${lang}${path}`,
      siteName: "Sentinel",
      locale: OG_LOCALE[lang],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
