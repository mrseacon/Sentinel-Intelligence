/**
 * Gemeinsame Bild-Erzeugung, importiert von einer opengraph-image.tsx +
 * twitter-image.tsx je Route (SEO-Redesign) — app/[lang]/, .../ampel/,
 * .../depot/, .../stress/, .../simulation/, .../analyze/. Alle rendern
 * exakt dasselbe Bild, damit LinkedIn/Slack (lesen og:image) und X/Twitter
 * (bevorzugt twitter:image, fällt sonst auf og:image zurück) dieselbe
 * Vorschau zeigen, ohne die JSX doppelt zu pflegen.
 *
 * Warum pro Route eine eigene Datei statt einer einzigen unter app/,
 * die laut Next.js-Doku eigentlich an alle Kind-Segmente vererbt werden
 * sollte (opengraph-image.md, "more specific image will take
 * precedence"): empirisch verifiziert (lokaler Dev-Server), dass die
 * Vererbung nicht greift, sobald eine Seite ihr eigenes
 * `generateMetadata` mit eigenem `openGraph`-Objekt exportiert (was hier
 * jede Route wegen Title/Description pro Sprache tut) — das og:image
 * bleibt dann leer. Eine Datei je Route ist deshalb keine Redundanz,
 * sondern die verlässliche Umgehung dieser Next.js-16.2.10-Eigenart.
 *
 * Bewusst statisches PNG statt handgestaltetem Bild: In dieser Umgebung
 * gibt es kein Bildbearbeitungswerkzeug, aber die exakten "Graphit &
 * Kupfer"-Farbwerte aus globals.css liegen als Code vor. `ImageResponse`
 * ohne Request-time-APIs wird laut Next.js-Doku am Build gerendert und
 * gecacht (next/dist/docs/.../opengraph-image.md, "statically
 * optimized") — im Ergebnis identisch zu einer eingecheckten PNG-Datei,
 * nur ohne zusätzliches Werkzeug und mit exaktem Marken-Farbabgleich.
 * Bewusst ohne eigene Schriftart (Newsreader/IBM Plex): das würde einen
 * Netzwerk-Fetch beim Build erfordern (Google Fonts) — ein Risiko fürs
 * "CI muss grün bleiben"-Gebot (CLAUDE.md). Satoris gebündelte
 * Standardschrift ist der pragmatische Kompromiss.
 */
import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_ALT = "Sentinel – Paper-Trading mit Risiko-Ampel";

// Literale Hex-Werte aus app/globals.css (Dark-Palette "Graphit &
// Kupfer") — Satori/@vercel/og unterstützt keine CSS custom properties.
const COLORS = {
  bg: "#141311",
  housing: "#2a2723",
  ink: "#f2efe9",
  soft: "#c4bdb4",
  faint: "#857e75",
  accent: "#e08a5b",
  alert: "#e0705f",
  warn: "#d9a63c",
  ok: "#5ca37d",
};

export function renderBrandImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: COLORS.bg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 10,
            padding: 16,
            borderRadius: 16,
            backgroundColor: COLORS.housing,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 28,
              height: 28,
              borderRadius: 999,
              backgroundColor: COLORS.alert,
            }}
          />
          <div
            style={{
              display: "flex",
              width: 28,
              height: 28,
              borderRadius: 999,
              backgroundColor: COLORS.warn,
            }}
          />
          <div
            style={{
              display: "flex",
              width: 28,
              height: 28,
              borderRadius: 999,
              backgroundColor: COLORS.ok,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 108,
            fontWeight: 600,
            color: COLORS.ink,
            letterSpacing: 2,
          }}
        >
          <span>Sentinel</span>
          <span style={{ color: COLORS.accent }}>.</span>
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: COLORS.soft }}>
          Paper-Trading mit Risiko-Ampel
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 60,
            fontSize: 20,
            color: COLORS.faint,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Verstehen statt raten
        </div>
      </div>
    ),
    OG_IMAGE_SIZE,
  );
}
