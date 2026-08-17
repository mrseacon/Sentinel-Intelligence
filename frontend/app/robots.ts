import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/i18n/metadata";

// Alles crawlbar: Das Frontend hat keine eigenen API-Routen (der Aufruf
// geht über NEXT_PUBLIC_API_URL direkt ans separate FastAPI-Backend,
// ARCHITECTURE.md §2) — es gibt hier also keine API-nahen Pfade, die
// ausgeschlossen werden müssten.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
