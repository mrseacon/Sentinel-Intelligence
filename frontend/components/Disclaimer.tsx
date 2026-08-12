"use client";

// Fester Disclaimer-Text (Designprinzip 3, ARCHITECTURE.md §1: "Disclaimer
// fest in der UI"). Braucht useI18n() -> Client-Komponente (war zuvor rein
// serverseitig, da der Text hartkodiert war).
import { useI18n } from "@/lib/i18n/I18nProvider";

export function Disclaimer() {
  const { dict } = useI18n();

  return (
    <p className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-muted">
      {dict.disclaimer.intro}
      <strong>{dict.disclaimer.strong}</strong>
      {dict.disclaimer.tail}
    </p>
  );
}
