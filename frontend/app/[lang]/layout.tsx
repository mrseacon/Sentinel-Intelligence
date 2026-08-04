import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <I18nProvider locale={lang}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
