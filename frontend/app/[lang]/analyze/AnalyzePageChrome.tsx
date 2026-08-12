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
        <LocaleLink href="/" className="text-sm text-soft">
          {dict.analyze.backToHome}
        </LocaleLink>
        <LanguageSwitcher />
      </div>
      <section className="mt-6 flex flex-col gap-6">
        <div className="flex max-w-[74ch] flex-col gap-2">
          <div className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
            {dict.analyze.kicker}
          </div>
          <h1 className="font-serif text-[34px] leading-[1.1] font-normal">
            {dict.analyze.pageTitle}
          </h1>
          <p className="text-[14.5px] leading-relaxed text-soft">
            {dict.analyze.independentNote}
          </p>
        </div>
        {children}
      </section>
    </>
  );
}
