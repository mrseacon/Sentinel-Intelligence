import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "../globals.css";

import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

import { Providers } from "./providers";

// Palette "Graphit & Kupfer" (visuelles Redesign): Newsreader für
// Headlines, IBM Plex Sans fürs UI, IBM Plex Mono für Zahlen/Kurse.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// I18N_DECISIONS.md §4: jede unterstützte Sprache wird statisch
// vorgerendert, `proxy.ts` sorgt für die Umleitung auf das Präfix.
export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(isLocale(lang) ? lang : DEFAULT_LOCALE);
  return {
    title: { default: "Sentinel", template: "%s · Sentinel" },
    description: dict.meta.description,
  };
}

// themeColor lebt seit Next.js 14 in einem eigenen `viewport`-Export,
// nicht mehr im `metadata`-Objekt (Breaking Change ggü. älteren Next-
// Versionen — s. node_modules/next/dist/docs Hinweis im Repo).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang: rawLang } = await params;
  // Defense in depth: proxy.ts only ever routes valid locales here, but
  // Next's generated params type is `string`, not the narrowed union —
  // an invalid value falls back to German instead of crashing (§6).
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;

  return (
    <html
      lang={lang}
      className={`${newsreader.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <I18nProvider locale={lang}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
