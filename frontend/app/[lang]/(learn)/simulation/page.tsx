import type { Metadata } from "next";

import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/i18n/metadata";

import { SimulationView } from "./SimulationView";

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
    path: "/simulation",
    title: dict.simulation.title,
    description: dict.meta.simulation.description,
  });
}

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in SimulationView (Client, braucht useDepot()/Hooks), gleiches Muster
// wie ampel/page.tsx und stress/page.tsx.
export default function SimulationPage() {
  return <SimulationView />;
}
