"use client";

// Verteilt Locale + Dictionary an Client-Komponenten (I18N_DECISIONS.md
// §1) — dasselbe Muster wie DepotProvider (FRONTEND_DECISIONS.md §2).
//
// WICHTIGER Unterschied zu Next.js' eigenem Dictionary-Beispiel (das
// Dictionary komplett server-seitig laden und NUR das Ergebnis-HTML an
// den Client schicken): unsere Dictionaries enthalten Funktionen für
// Platzhalter-Interpolation (z. B. `depot.subtitle(startCash)`), und
// Funktionen können nicht als Server->Client-Prop übergeben werden (React
// serialisiert nur Daten). Der Server-Layout übergibt deshalb nur die
// (bereits als String garantierte) `locale`, das Dictionary selbst wird
// hier client-seitig importiert. `getDictionary()` bleibt trotzdem
// nützlich für rein serverseitige Verwendung ohne Client-Grenze
// (generateMetadata in app/[lang]/layout.tsx).
import { createContext, useContext } from "react";

import type { Locale } from "./config";
import de from "./dictionaries/de";
import en from "./dictionaries/en";
import type { Dictionary } from "./dictionaries/de";

const DICTIONARIES: Record<Locale, Dictionary> = { de, en };

interface I18nValue {
  locale: Locale;
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dict: DICTIONARIES[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() must be used within an I18nProvider.");
  }
  return ctx;
}
