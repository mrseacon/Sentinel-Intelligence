import type { Metadata } from "next";

import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/i18n/metadata";

import { DepotView } from "./DepotView";

// generateMetadata statt `export const metadata`, weil der Titel jetzt
// vom Locale-Segment abhängt (I18N_DECISIONS.md §5).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/depot",
    title: dict.depot.title,
    description: dict.meta.depot.description,
  });
}

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in DepotView (Client, braucht useDepot()/Hooks).
export default function DepotPage() {
  return <DepotView />;
}
