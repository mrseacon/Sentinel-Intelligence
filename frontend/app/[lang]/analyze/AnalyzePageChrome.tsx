"use client";

// UI-Chrome für /analyze (Zurück-Link, Überschrift, Sprachumschalter) als
// eigene Client-Komponente ausgelagert, damit page.tsx eine Server-
// Komponente bleiben kann (`generateMetadata`, App Router erlaubt keine
// Metadata-Exports in "use client"-Dateien).
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LocaleLink } from "@/lib/i18n/link";

export function AnalyzePageChrome({ children }: { children: React.ReactNode }) {
  const { dict } = useI18n();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <LocaleLink
          href="/"
          className="text-sm text-slate-500 hover:underline dark:text-slate-400"
        >
          {dict.analyze.backToHome}
        </LocaleLink>
        <LanguageSwitcher />
      </div>
      <section className="mt-6 space-y-4">
        <h1 className="text-2xl font-semibold">{dict.analyze.pageTitle}</h1>
        {children}
      </section>
    </>
  );
}
