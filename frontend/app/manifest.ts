import type { MetadataRoute } from "next";

// PWA-Grundkonfiguration (ARCHITECTURE.md §2: "PWA-fähig"). Bewusst nur
// das Web-App-Manifest + Icons — Offline-Support/Service-Worker ist laut
// §8-Roadmap "PWA-Feinschliff" für Phase 2, kein v1-Scope.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sentinel – Risiko-Ampel für dein Paper-Depot",
    short_name: "Sentinel",
    description:
      "Paper-Trading mit Risiko-Ampel: vom ersten Spielgeld-Trade zum verstandenen Portfolio.",
    start_url: "/depot",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
