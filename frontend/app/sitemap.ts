import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/i18n/metadata";

// Priorität/Frequenz je Route (ARCHITECTURE.md §2/§6): Landing ist der
// öffentliche Einstieg (höchste Priorität), /depot hängt komplett vom
// lokalen localStorage-Zustand des Nutzers ab (§4.1) und bekommt daher
// bewusst die niedrigste — Aufgabenstellung nennt genau dieses Beispiel.
const ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
}> = [
  { path: "", priority: 1, changeFrequency: "monthly" },
  { path: "/analyze", priority: 0.6, changeFrequency: "monthly" },
  { path: "/ampel", priority: 0.5, changeFrequency: "monthly" },
  { path: "/stress", priority: 0.4, changeFrequency: "monthly" },
  { path: "/simulation", priority: 0.4, changeFrequency: "monthly" },
  { path: "/depot", priority: 0.3, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ROUTES.flatMap(({ path, priority, changeFrequency }) => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]),
    );

    // Ein <url>-Eintrag pro Sprachversion, jeweils mit hreflang-Links zu
    // allen Versionen inkl. sich selbst (Google-Empfehlung fürs
    // Sitemap-basierte hreflang, s. sitemap.md "Generate a localized
    // Sitemap" in der Next.js-Doku).
    return LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
