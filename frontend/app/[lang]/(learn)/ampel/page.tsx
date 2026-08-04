import type { Metadata } from "next";

import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

import { AmpelView } from "./AmpelView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(isLocale(lang) ? lang : DEFAULT_LOCALE);
  return { title: dict.nav.ampel };
}

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in AmpelView (Client, braucht useDepot()/Hooks).
export default function AmpelPage() {
  return <AmpelView />;
}
