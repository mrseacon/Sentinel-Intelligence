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
 * gibt es kein Bildbearbeitungswerkzeug. `ImageResponse` ohne Request-
 * time-APIs wird laut Next.js-Doku am Build gerendert und gecacht
 * (next/dist/docs/.../opengraph-image.md, "statically optimized") — im
 * Ergebnis identisch zu einer eingecheckten PNG-Datei.
 *
 * Marken-Schriften LOKAL statt per Netzwerk-Fetch: ImageResponse/Satori
 * unterstützt nur ttf/otf/woff (next/dist/docs/.../image-response.md),
 * next/font/google liefert aber nur woff2 + gesplittete Unicode-Ranges
 * (siehe .next/static/media) — dafür ungeeignet. Die fünf Schnitte unten
 * (Newsreader Regular, IBM Plex Sans Regular/Medium, IBM Plex Mono
 * Regular/Medium — exakt die Schnitte, die app/[lang]/layout.tsx +
 * globals.css tatsächlich für Headline/UI/Zahlen verwenden) liegen
 * deshalb einmalig heruntergeladen und committed unter
 * frontend/assets/fonts/ (SIL OFL, Lizenztexte daneben). Kein
 * Netzwerk-Zugriff mehr zur Build-Zeit — das war die berechtigte Sorge
 * aus der Vorversion und bleibt bestehen. Referenz für das
 * `fonts`-Array-Format: node_modules/next/dist/docs/.../image-response.md
 * "Custom fonts".
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_ALT = "Sentinel – Paper-Trading mit Risiko-Ampel";

// Literale Hex-Werte aus app/globals.css (Dark-Palette "Graphit &
// Kupfer") — Satori/@vercel/og unterstützt keine CSS custom properties.
const COLORS = {
  bg: "#141311",
  surface: "#1c1b18",
  housing: "#2a2723",
  border: "#322f2a",
  ink: "#f2efe9",
  soft: "#c4bdb4",
  muted: "#a29b92",
  faint: "#857e75",
  accent: "#e08a5b",
  alert: "#e0705f",
  warn: "#d9a63c",
  ok: "#5ca37d",
};

const FONT_DIR = join(process.cwd(), "assets/fonts");

const FACTS = [
  { value: "10.000 €", label: "Virtuelles Startkapital" },
  { value: "15 Min.", label: "Verzögerung der Kursdaten" },
  { value: "3", label: "Historische Krisen-Szenarien" },
];

async function loadFonts() {
  const [newsreader, plexSansRegular, plexSansMedium, plexMonoRegular, plexMonoMedium] =
    await Promise.all([
      readFile(join(FONT_DIR, "Newsreader-Display-Regular.ttf")),
      readFile(join(FONT_DIR, "IBMPlexSans-Regular.ttf")),
      readFile(join(FONT_DIR, "IBMPlexSans-Medium.ttf")),
      readFile(join(FONT_DIR, "IBMPlexMono-Regular.ttf")),
      readFile(join(FONT_DIR, "IBMPlexMono-Medium.ttf")),
    ]);

  return [
    { name: "Newsreader", data: newsreader, weight: 400 as const, style: "normal" as const },
    { name: "IBM Plex Sans", data: plexSansRegular, weight: 400 as const, style: "normal" as const },
    { name: "IBM Plex Sans", data: plexSansMedium, weight: 500 as const, style: "normal" as const },
    { name: "IBM Plex Mono", data: plexMonoRegular, weight: 400 as const, style: "normal" as const },
    { name: "IBM Plex Mono", data: plexMonoMedium, weight: 500 as const, style: "normal" as const },
  ];
}

export async function renderBrandImage() {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          backgroundColor: COLORS.bg,
          padding: "56px 72px",
        }}
      >
        {/* Kicker — gleiches Muster wie die Seiten-Kicker im Produkt
            (font-mono, uppercase, weite Tracking, faint), s. z. B.
            AmpelView.tsx "font-mono text-[10.5px] tracking-[0.16em]". */}
        <div
          style={{
            display: "flex",
            fontFamily: "IBM Plex Mono",
            fontWeight: 400,
            fontSize: 16,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: COLORS.faint,
          }}
        >
          Paper-Trading · Risiko-Ampel · Krisen-Test
        </div>

        {/* Wortmarke — Ampel-Housing mit den drei Status-Punkten,
            darunter "Sentinel." exakt wie im echten Header (Newsreader,
            uppercase per textTransform, weite Tracking), darunter der
            Claim in IBM Plex Sans. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              padding: 14,
              borderRadius: 14,
              backgroundColor: COLORS.housing,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 24,
                height: 24,
                borderRadius: 999,
                backgroundColor: COLORS.alert,
              }}
            />
            <div
              style={{
                display: "flex",
                width: 24,
                height: 24,
                borderRadius: 999,
                backgroundColor: COLORS.warn,
              }}
            />
            <div
              style={{
                display: "flex",
                width: 24,
                height: 24,
                borderRadius: 999,
                backgroundColor: COLORS.ok,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontWeight: 400,
              fontSize: 126,
              lineHeight: 1,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: COLORS.ink,
            }}
          >
            <span>Sentinel</span>
            <span style={{ color: COLORS.accent }}>.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Sans",
              fontWeight: 400,
              fontSize: 34,
              color: COLORS.soft,
            }}
          >
            Paper-Trading mit Risiko-Ampel
          </div>
        </div>

        {/* Fakten-Streifen — dieselbe Komposition wie die Hero-Facts auf
            der echten Landing-Page (app/[lang]/page.tsx: geränderte
            3-Spalten-Kachelreihe, Wert in Mono, Label in Sans). */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ display: "flex", height: 1, backgroundColor: COLORS.border, marginBottom: 28 }} />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden",
            }}
          >
            {FACTS.map((fact, i) => (
              <div
                key={fact.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: 6,
                  backgroundColor: COLORS.surface,
                  padding: "20px 26px",
                  borderRight: i < FACTS.length - 1 ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    fontFamily: "IBM Plex Mono",
                    fontWeight: 500,
                    fontSize: 24,
                    letterSpacing: -0.5,
                    color: COLORS.ink,
                  }}
                >
                  {fact.value}
                </span>
                <span
                  style={{
                    display: "flex",
                    fontFamily: "IBM Plex Sans",
                    fontWeight: 400,
                    fontSize: 16,
                    color: COLORS.muted,
                  }}
                >
                  {fact.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE, fonts },
  );
}
