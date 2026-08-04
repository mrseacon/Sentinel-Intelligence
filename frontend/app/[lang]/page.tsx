import Link from "next/link";

import { Disclaimer } from "@/components/Disclaimer";
import { HeroDemo } from "@/components/HeroDemo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

// Reine Server-Komponente bis auf HeroDemo (Client, simulierter Slider
// ohne Backend-Anbindung; holt sein Dictionary selbst über useI18n(),
// s. HeroDemo.tsx). Struktur/Texte/visuelles Konzept aus
// docs/design/Sentinel Landing.dc.html übernommen, aber als Tailwind-
// Komponente mit den bestehenden Projekt-Konventionen umgesetzt (siehe
// Depot/Ampel/Stress-Views) statt der Inline-Styles aus dem Export.
// Farben/Schwellen der Ampel-Beispiele: s. Kommentar in HeroDemo.tsx.
// Das Anlegen des Depots passiert erst im Ziel (/depot).
//
// Diese Seite bleibt bewusst eine Server-Komponente (kein "use client"):
// sie braucht keine Interaktivität außer HeroDemo, das schon Client ist.
// Statt useI18n() lädt sie ihr Dictionary direkt über `params.lang`
// (Next.js' eigenes Server-Komponenten-Muster, I18N_DECISIONS.md §1) und
// baut interne Links manuell mit dem Locale-Präfix zusammen (LocaleLink
// ist ein Client-Wrapper und würde diese Seite unnötig client-seitig
// machen).

const navLinkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";

const ctaClass =
  "inline-flex items-center justify-center rounded-full bg-slate-900 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

const eyebrowClass =
  "font-mono text-[11px] tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400";

// Farben nach dem stabilen `status`-Key statt nach dem übersetzten
// `label`-Text abgeleitet (der wäre im englischen Dictionary anders).
const LANDING_AMPEL_BORDER: Record<"green" | "yellow" | "red", string> = {
  green: "border-l-emerald-500",
  yellow: "border-l-amber-500",
  red: "border-l-red-500",
};

const LANDING_AMPEL_BADGE: Record<"green" | "yellow" | "red", string> = {
  green:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  yellow:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3.5">
          <Link href={href("/")} className="flex items-center gap-2">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded border border-slate-400 dark:border-slate-500">
              <span className="h-1.5 w-1.5 rounded-[1px] bg-slate-400 dark:bg-slate-500" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Sentinel
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
              className="ml-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {t.ctaStart}
            </Link>
            <LanguageSwitcher />
          </nav>
          <div className="flex items-center gap-2 sm:hidden">
            <LanguageSwitcher />
            <Link
              href={href("/depot")}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            >
              {t.nav.ctaShort}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section
          id="hero"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-28">
            <span className={eyebrowClass}>{t.hero.eyebrow}</span>
            <h1 className="max-w-[22ch] text-center text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              {t.hero.title}
            </h1>
            <p className="max-w-[58ch] text-center text-lg leading-relaxed text-pretty text-slate-600 sm:text-xl dark:text-slate-300">
              {t.hero.body}
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link href={href("/depot")} className={ctaClass}>
                {t.ctaStart}
              </Link>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t.hero.ctaHint}
              </span>
            </div>
            <HeroDemo />
          </div>
        </section>

        <section
          id="wie"
          className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.how.eyebrow}</span>
            <h2 className="max-w-[26ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.how.title}
            </h2>
            <p className="max-w-[56ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.how.body}
            </p>
            <ol className="w-full max-w-2xl divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {t.how.steps.map((step) => (
                <li
                  key={step.number}
                  className="grid grid-cols-[52px_1fr] gap-5 py-5"
                >
                  <span className="font-mono text-sm text-slate-400 dark:text-slate-500">
                    {step.number}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="ampel"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.ampel.eyebrow}</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.ampel.title}
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.ampel.body}
            </p>
            <div className="grid w-full gap-4 text-left sm:grid-cols-3">
              {t.ampel.examples.map((ampel) => (
                <div
                  key={ampel.title}
                  className={`space-y-3 rounded-lg border border-slate-200 border-l-4 p-5 dark:border-slate-800 ${LANDING_AMPEL_BORDER[ampel.status]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{ampel.title}</h3>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${LANDING_AMPEL_BADGE[ampel.status]}`}
                    >
                      <span aria-hidden="true">{ampel.icon}</span>
                      {ampel.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {ampel.text}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ampel.lesson}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="krisen"
          className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.crises.eyebrow}</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.crises.title}
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.crises.body}
            </p>
            <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
              {t.crises.examples.map((crisis) => (
                <div
                  key={crisis.title}
                  className="space-y-3.5 rounded-lg border border-slate-200 p-5 dark:border-slate-800"
                >
                  <div className="space-y-0.5">
                    <span className="block text-sm font-semibold">
                      {crisis.title}
                    </span>
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                      {crisis.range}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                      style={{ width: `${crisis.depth}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {crisis.text}
                  </p>
                </div>
              ))}
            </div>
            <p className="max-w-[60ch] text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {t.crises.footnote}
            </p>
          </div>
        </section>

        <section
          id="simulation"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.simulation.eyebrow}</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.simulation.title}
            </h2>
            <p className="max-w-[58ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.simulation.body}
            </p>
            <div className="grid w-full max-w-3xl gap-8 rounded-xl border border-slate-200 p-6 text-left sm:grid-cols-[1.35fr_1fr] sm:items-center dark:border-slate-800">
              <div className="space-y-3">
                <div className="relative h-48 overflow-hidden border-b border-l border-slate-200 dark:border-slate-800">
                  <div
                    className="absolute inset-x-0 top-[12%] bottom-[12%] bg-gradient-to-r from-slate-200/20 to-slate-400/60 dark:from-slate-700/20 dark:to-slate-500/50"
                    style={{
                      clipPath: "polygon(0 46%, 100% 0, 100% 100%, 0 54%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 top-[26%] bottom-[26%] bg-gradient-to-r from-slate-300/30 to-slate-500/70 dark:from-slate-600/30 dark:to-slate-400/60"
                    style={{
                      clipPath: "polygon(0 46%, 100% 12%, 100% 88%, 0 54%)",
                    }}
                  />
                  <div className="absolute inset-x-0 top-1/2 h-px origin-left -rotate-6 bg-slate-400 dark:bg-slate-500" />
                </div>
                <div className="flex justify-between font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{t.simulation.axis.today}</span>
                  <span>{t.simulation.axis.y1}</span>
                  <span>{t.simulation.axis.y5}</span>
                  <span>{t.simulation.axis.y10}</span>
                </div>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                <div className="space-y-1 pb-4">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    {t.simulation.bands.top.label}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {t.simulation.bands.top.text}
                  </p>
                </div>
                <div className="space-y-1 py-4">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    {t.simulation.bands.middle.label}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {t.simulation.bands.middle.text}
                  </p>
                </div>
                <div className="space-y-1 pt-4">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    {t.simulation.bands.bottom.label}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {t.simulation.bands.bottom.text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="methodik"
          className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.methodology.eyebrow}</span>
            <h2 className="max-w-[26ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.methodology.title}
            </h2>
            <p className="max-w-[60ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.methodology.body}
            </p>
            <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2">
              {t.methodology.cards.map((card) => (
                <div
                  key={card.title}
                  className="space-y-2 rounded-lg border border-slate-200 p-5 dark:border-slate-800"
                >
                  <h3 className="text-sm font-semibold">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="start"
          className="border-b border-slate-200 dark:border-slate-800"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-6 py-20 sm:py-24">
            <span className={eyebrowClass}>{t.start.eyebrow}</span>
            <h2 className="max-w-[24ch] text-center text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem]">
              {t.start.title}
            </h2>
            <p className="max-w-[54ch] text-center text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              {t.start.body}
            </p>
            <Link href={href("/depot")} className={ctaClass}>
              {t.ctaStart}
            </Link>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t.start.ctaHint}
            </span>
          </div>
        </section>
      </main>

      <footer>
        <Disclaimer />
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-5 px-6 pb-10 text-sm">
          <a
            href="#methodik"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t.footer.methodology}
          </a>
          <a
            href="#wie"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t.footer.how}
          </a>
          <Link
            href={href("/depot")}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t.ctaStart}
          </Link>
        </div>
      </footer>
    </div>
  );
}
