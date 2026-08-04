"use client";

// Locale-Präfix-Wrapper um next/link (I18N_DECISIONS.md §1: die eine
// dokumentierte Lücke der Eigenlösung gegenüber next-intl). JEDER interne
// Link muss diesen Wrapper statt next/link direkt verwenden, sonst
// verliert die Navigation beim Klick das aktuelle Sprachpräfix. Externe
// Links, In-Page-Anker (#wie) und next/link-Sonderfälle mit Objekt-`href`
// bleiben unverändert (nur absolute Pfade werden präfigiert).
import NextLink from "next/link";
import type { ComponentProps } from "react";

import { useI18n } from "./I18nProvider";

type LocaleLinkProps = ComponentProps<typeof NextLink>;

export function LocaleLink({ href, ...rest }: LocaleLinkProps) {
  const { locale } = useI18n();

  const prefixedHref =
    typeof href === "string" && href.startsWith("/") && !href.startsWith("//")
      ? `/${locale}${href === "/" ? "" : href}`
      : href;

  return <NextLink href={prefixedHref} {...rest} />;
}
