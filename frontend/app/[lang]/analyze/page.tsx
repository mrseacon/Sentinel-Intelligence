import type { Metadata } from "next";

import { AnalyzePageChrome } from "./AnalyzePageChrome";
import { AnalyzeView } from "./AnalyzeView";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/i18n/metadata";

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
    path: "/analyze",
    title: dict.analyze.pageTitle,
    description: dict.meta.analyze.description,
  });
}

// Bewusst außerhalb der (learn)-Route-Group (FRONTEND_DECISIONS.md §7):
// freie "Was wäre wenn"-Portfolios sollen das Lern-Depot nicht berühren,
// daher eigene, minimale Navigation statt der Depot/Ampel/Stress-Leiste.
// Server-Komponente wegen `metadata`; die Chrome-Texte (Zurück-Link,
// Überschrift) brauchen useI18n() -> ausgelagert in eine kleine
// Client-Komponente (AnalyzePageChrome), AnalyzeView bleibt unverändert.
export default function AnalyzePage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <AnalyzePageChrome>
        <AnalyzeView />
      </AnalyzePageChrome>
    </div>
  );
}
