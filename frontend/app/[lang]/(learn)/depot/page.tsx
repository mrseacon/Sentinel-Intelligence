import type { Metadata } from "next";

import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

import { DepotView } from "./DepotView";

// generateMetadata statt `export const metadata`, weil der Titel jetzt
// vom Locale-Segment abhängt (I18N_DECISIONS.md §5).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(isLocale(lang) ? lang : DEFAULT_LOCALE);
  return { title: dict.nav.depot };
}

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in DepotView (Client, braucht useDepot()/Hooks).
export default function DepotPage() {
  return <DepotView />;
}
