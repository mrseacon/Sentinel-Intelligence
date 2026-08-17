import type { Metadata } from "next";
import Link from "next/link";

import { Disclaimer } from "@/components/Disclaimer";
import { HeroDemo } from "@/components/HeroDemo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPageMetadata, SITE_URL } from "@/lib/i18n/metadata";

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
    path: "",
    title: dict.meta.landing.title,
    description: dict.meta.landing.description,
    titleIsAbsolute: true,
  });
}

// Reine Server-Komponente bis auf HeroDemo (Client, simulierter Slider
// ohne Backend-Anbindung; holt sein Dictionary selbst über useI18n(),
// s. HeroDemo.tsx). Struktur/Texte aus dem ursprünglichen Landing-Export
// übernommen, Redesign (Schritt 7) bringt nur Farben/Schrift/Kartenmuster
// aus "Sentinel App.dc.html" — die Sektionsstruktur weicht bewusst vom
// dortigen Mockup ab (das baut fünf eigene Chart-Widgets neu auf, die
// exakt das duplizieren, was Depot/Ampel/Stress/Simulation/Analyze schon
// zeigen; hier reichen kompakte, echte Vorschauen).
// Das Anlegen des Depots passiert erst im Ziel (/depot).
//
// Diese Seite bleibt bewusst eine Server-Komponente (kein "use client"):
// sie braucht keine Interaktivität außer HeroDemo, das schon Client ist.
// Statt useI18n() lädt sie ihr Dictionary direkt über `params.lang`
// (Next.js' eigenes Server-Komponenten-Muster, I18N_DECISIONS.md §1) und
// baut interne Links manuell mit dem Locale-Präfix zusammen (LocaleLink
// ist ein Client-Wrapper und würde diese Seite unnötig client-seitig
// machen).

const navLinkClass = "rounded-md px-3 py-2 text-sm font-medium text-soft no-underline transition-colors hover:text-ink";

const ctaClass =
  "inline-flex items-center justify-center rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-ink no-underline transition-transform hover:-translate-y-0.5";

const eyebrowClass = "font-mono text-[11px] tracking-[0.16em] text-faint uppercase";

const headingClass = "font-serif font-normal tracking-tight text-balance";

// Farben nach dem stabilen `status`-Key statt nach dem übersetzten
// `label`-Text abgeleitet (der wäre im englischen Dictionary anders).
type Level = "green" | "yellow" | "red";

const LAMP_ON_VAR: Record<Level, string> = {
  red: "var(--alert)",
  yellow: "var(--warn)",
  green: "var(--ok)",
};
const LAMP_OFF_VAR: Record<Level, string> = {
  red: "var(--lamp-off-r)",
  yellow: "var(--lamp-off-y)",
  green: "var(--lamp-off-g)",
};
const LAMP_ORDER: Level[] = ["red", "yellow", "green"];
const STATUS_INK: Record<Level, string> = {
  green: "var(--ok)",
  yellow: "var(--warn)",
  red: "var(--alert)",
};

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = await getDictionary(lang);
  const t = dict.landing;
  const href = (path: string) => `/${lang}${path}`;

  // Structured Data (SEO-Redesign, Next.js-Doku empfiehlt genau dieses
  // Muster statt eines dedizierten Metadata-Feldes, s.
  // node_modules/next/dist/docs/.../json-ld.md). WebApplication statt
  // SoftwareApplication: Sentinel läuft im Browser, ist keine
  // installierbare Software. `<`-Escaping laut Doku gegen XSS über den
  // JSON-Payload.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Sentinel",
    description: dict.meta.landing.description,
    url: `${SITE_URL}/${lang}`,
    inLanguage: lang,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3.5">
          <Link href={href("/")} className="flex items-center gap-2 no-underline">
            <span className="font-serif text-xl tracking-[0.1em] uppercase">
              Sentinel<span className="text-accent">.</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <a href="#wie" className={navLinkClass}>
              {t.nav.how}
            </a>
            <Link href={href("/ampel")} className={navLinkClass}>
              {t.nav.ampel}
            </Link>
            <Link href={href("/stress")} className={navLinkClass}>
              {t.nav.crises}
            </Link>
            <a href="#methodik" className={navLinkClass}>
              {t.nav.methodology}
            </a>
            <Link
              href={href("/depot")}
              className="ml-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink no-underline"
            >
              {t.ctaStart}
            </Link>
            <LanguageSwitcher />
          </nav>
          <div className="flex items-center gap-2 sm:hidden">
            <LanguageSwitcher />
            <Link
              href={href("/depot")}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink no-underline"
            >
              {t.nav.ctaShort}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section id="hero" className="border-b border-border">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-28">
            <span className={eyebrowClass}>{t.hero.eyebrow}</span>
            <h1 className={`max-w-[22ch] text-center text-4xl ${headingClass} sm:text-6xl`}>
              {t.hero.title}
            </h1>
            <p className="max-w-[58ch] text-center text-lg leading-relaxed text-pretty text-soft sm:text-xl">
              {t.hero.body}
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link href={href("/depot")} className={ctaClass}>
                {t.ctaStart}
              </Link>
              <span className="text-sm text-muted">{t.hero.ctaHint}</span>
            </div>

            <div className="grid w-full max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-3">
              {t.facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-1 bg-surface px-4 py-4">
                  <span className="font-mono text-[17px] tracking-[-0.02em]">{fact.value}</span>
                  <span className="text-[12.5px] leading-snug text-muted">{fact.label}</span>
                </div>
              ))}
            </div>

            <HeroDemo />
          </div>
        </section>

        <section id="wie" className="border-b border-border bg-sunken">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.how.eyebrow}</span>
            <h2 className={`max-w-[26ch] text-center text-3xl ${headingClass} sm:text-4xl`}>
              {t.how.title}
            </h2>
            <p className="max-w-[56ch] text-center text-base leading-relaxed text-soft sm:text-lg">
              {t.how.body}
            </p>
            <ol className="w-full max-w-2xl divide-y divide-border border-t border-b border-border">
              {t.how.steps.map((step) => (
                <li key={step.number} className="grid grid-cols-[52px_1fr] gap-5 py-5">
                  <span className="font-mono text-sm text-faint">{step.number}</span>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="ampel" className="border-b border-border">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.ampel.eyebrow}</span>
            <h2 className={`max-w-[24ch] text-center text-3xl ${headingClass} sm:text-4xl`}>
              {t.ampel.title}
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-soft sm:text-lg">
              {t.ampel.body}
            </p>
            <div className="grid w-full gap-4 text-left sm:grid-cols-3">
              {t.ampel.examples.map((ampel) => (
                <div
                  key={ampel.title}
                  className="flex gap-3.5 rounded-xl border border-border bg-surface p-5 shadow-elevated"
                >
                  <div
                    className="flex flex-none flex-col gap-[5px] rounded-[8px] p-[5px]"
                    style={{ background: "var(--housing)" }}
                  >
                    {LAMP_ORDER.map((lamp) => (
                      <span
                        key={lamp}
                        className="h-[13px] w-[13px] rounded-full"
                        style={{
                          background:
                            lamp === ampel.status ? LAMP_ON_VAR[lamp] : LAMP_OFF_VAR[lamp],
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{ampel.title}</h3>
                      <span
                        className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: STATUS_INK[ampel.status] }}
                      >
                        <span aria-hidden="true">{ampel.icon}</span>
                        {ampel.label}
                      </span>
                    </div>
                    <p className="text-sm text-soft">{ampel.text}</p>
                    <p className="text-xs text-muted">{ampel.lesson}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="krisen" className="border-b border-border bg-sunken">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.crises.eyebrow}</span>
            <h2 className={`max-w-[24ch] text-center text-3xl ${headingClass} sm:text-4xl`}>
              {t.crises.title}
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-soft sm:text-lg">
              {t.crises.body}
            </p>
            <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
              {t.crises.examples.map((crisis) => (
                <div
                  key={crisis.title}
                  className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5 shadow-elevated"
                >
                  <div className="space-y-0.5">
                    <span className="block text-sm font-semibold">{crisis.title}</span>
                    <span className="font-mono text-xs text-faint">{crisis.range}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${crisis.depth}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{crisis.text}</p>
                </div>
              ))}
            </div>
            <p className="max-w-[60ch] text-center text-sm leading-relaxed text-muted">
              {t.crises.footnote}
            </p>
          </div>
        </section>

        <section id="simulation" className="border-b border-border">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.simulation.eyebrow}</span>
            <h2 className={`max-w-[24ch] text-center text-3xl ${headingClass} sm:text-4xl`}>
              {t.simulation.title}
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-soft sm:text-lg">
              {t.simulation.body}
            </p>
            <div className="grid w-full max-w-3xl gap-8 rounded-xl border border-border bg-surface p-6 text-left shadow-elevated sm:grid-cols-[1.35fr_1fr] sm:items-center">
              <div className="space-y-3">
                <div className="relative h-48 overflow-hidden border-b border-l border-border">
                  <div
                    className="absolute inset-x-0 top-[12%] bottom-[12%] bg-gradient-to-r from-[var(--accent-tint)] to-[var(--ser-1)] opacity-40"
                    style={{
                      clipPath: "polygon(0 46%, 100% 0, 100% 100%, 0 54%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 top-[26%] bottom-[26%] bg-gradient-to-r from-[var(--accent-tint)] to-[var(--ser-1)] opacity-70"
                    style={{
                      clipPath: "polygon(0 46%, 100% 12%, 100% 88%, 0 54%)",
                    }}
                  />
                  <div className="absolute inset-x-0 top-1/2 h-px origin-left -rotate-6 bg-[var(--ser-1)]" />
                </div>
                <div className="flex justify-between font-mono text-[11px] text-faint">
                  <span>{t.simulation.axis.today}</span>
                  <span>{t.simulation.axis.y1}</span>
                  <span>{t.simulation.axis.y5}</span>
                  <span>{t.simulation.axis.y10}</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                <div className="space-y-1 pb-4">
                  <span className="font-mono text-xs text-faint">
                    {t.simulation.bands.top.label}
                  </span>
                  <p className="text-sm text-soft">{t.simulation.bands.top.text}</p>
                </div>
                <div className="space-y-1 py-4">
                  <span className="font-mono text-xs text-faint">
                    {t.simulation.bands.middle.label}
                  </span>
                  <p className="text-sm text-soft">{t.simulation.bands.middle.text}</p>
                </div>
                <div className="space-y-1 pt-4">
                  <span className="font-mono text-xs text-faint">
                    {t.simulation.bands.bottom.label}
                  </span>
                  <p className="text-sm text-soft">{t.simulation.bands.bottom.text}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="methodik" className="border-b border-border bg-sunken">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.methodology.eyebrow}</span>
            <h2 className={`max-w-[26ch] text-center text-3xl ${headingClass} sm:text-4xl`}>
              {t.methodology.title}
            </h2>
            <p className="max-w-[60ch] text-center text-base leading-relaxed text-soft sm:text-lg">
              {t.methodology.body}
            </p>
            <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2">
              {t.methodology.cards.map((card) => (
                <div
                  key={card.title}
                  className="space-y-2 rounded-xl border border-border bg-surface p-5 shadow-elevated"
                >
                  <h3 className="text-sm font-semibold">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="start" className="border-b border-border">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.start.eyebrow}</span>
            <h2 className={`max-w-[24ch] text-center text-3xl ${headingClass} sm:text-[2.75rem]`}>
              {t.start.title}
            </h2>
            <p className="max-w-[54ch] text-center text-base leading-relaxed text-soft sm:text-lg">
              {t.start.body}
            </p>
            <Link href={href("/depot")} className={ctaClass}>
              {t.ctaStart}
            </Link>
            <span className="text-sm text-muted">{t.start.ctaHint}</span>
          </div>
        </section>
      </main>

      <footer>
        <Disclaimer />
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-5 px-6 pb-10 text-sm">
          <a href="#methodik" className="text-faint no-underline hover:text-ink">
            {t.footer.methodology}
          </a>
          <a href="#wie" className="text-faint no-underline hover:text-ink">
            {t.footer.how}
          </a>
          <Link href={href("/depot")} className="text-faint no-underline hover:text-ink">
            {t.ctaStart}
          </Link>
        </div>
      </footer>
    </div>
  );
}
