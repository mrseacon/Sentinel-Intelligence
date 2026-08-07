"use client";

// Kostenlose Schlagzeilen pro Depot-Position (GET /news/headlines, kein
// LLM/AI-Gate). Aufklappbar UND erst nach dem Öffnen geladen (`enabled`
// s.u.) — der Backend-Fetch throttlet mehrere RSS-Anfragen
// (sentinel_core/ai/news.py §9), das soll nicht bei jedem Seitenaufruf
// für jede Position gleichzeitig feuern. Reine Fakten: nur Titel, Quelle
// und Link — kein Interpretations- oder Erklärtext (Prinzip 3).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, getNewsHeadlines } from "@/lib/api";
import { formatIsoDate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/I18nProvider";

const MAX_SHOWN_HEADLINES = 4;

export function PositionNews({ ticker }: { ticker: string }) {
  const { dict } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="border-t border-border"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-2.5 text-[11px] tracking-[0.08em] text-faint uppercase transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 16 16"
          className={`h-2.5 w-2.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M3 6l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {dict.positionNews.summary}
      </summary>
      <div className="bg-sunken px-5 pb-4">{isOpen && <NewsList ticker={ticker} />}</div>
    </details>
  );
}

function NewsList({ ticker }: { ticker: string }) {
  const { dict, locale } = useI18n();
  const newsQuery = useQuery({
    queryKey: ["news", "headlines", ticker],
    queryFn: () => getNewsHeadlines(ticker),
  });

  if (newsQuery.error instanceof ApiError) {
    return (
      <ErrorNotice
        error={newsQuery.error}
        onRetry={() => newsQuery.refetch()}
      />
    );
  }

  if (newsQuery.isPending || !newsQuery.data) {
    return (
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  const headlines = newsQuery.data.headlines.slice(0, MAX_SHOWN_HEADLINES);

  // Eine leere Liste ist ein normaler Zustand, kein Fehler (§9: der
  // Feed liefert warnend [] statt zu werfen) — still anzeigen.
  if (headlines.length === 0) {
    return <p className="pt-1 text-sm text-muted">{dict.positionNews.none}</p>;
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-[11.5px] text-faint">
        {dict.positionNews.coverageFor(ticker)}
      </p>
      {headlines.map((headline) => (
        <div
          key={headline.link || headline.title}
          className="grid grid-cols-[76px_1fr] items-baseline gap-3 border-b border-border pb-2 last:border-0"
        >
          <span className="font-mono text-[11px] text-faint">
            {headline.published
              ? formatIsoDate(headline.published.slice(0, 10), locale)
              : ""}
          </span>
          <div className="flex flex-col gap-0.5">
            {headline.link ? (
              <a
                href={headline.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13.5px] leading-snug text-ink underline hover:text-accent"
              >
                {headline.title}
              </a>
            ) : (
              <span className="text-[13.5px] leading-snug text-ink">
                {headline.title}
              </span>
            )}
            <span className="text-[11.5px] text-muted">{headline.source}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
