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
import { useI18n } from "@/lib/i18n/I18nProvider";

const MAX_SHOWN_HEADLINES = 4;

export function PositionNews({ ticker }: { ticker: string }) {
  const { dict } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="text-sm"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
        {dict.positionNews.summary}
      </summary>
      <div className="mt-2">{isOpen && <NewsList ticker={ticker} />}</div>
    </details>
  );
}

function NewsList({ ticker }: { ticker: string }) {
  const { dict } = useI18n();
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
      <div className="space-y-1.5">
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
    return (
      <p className="text-slate-500 dark:text-slate-400">{dict.positionNews.none}</p>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-slate-500 dark:text-slate-400">
        {dict.positionNews.coverageFor(ticker)}
      </p>
      <ul className="space-y-1">
        {headlines.map((headline) => (
          <li key={headline.link || headline.title}>
            {headline.link ? (
              <a
                href={headline.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 underline hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
              >
                {headline.title}
              </a>
            ) : (
              <span className="text-slate-700 dark:text-slate-200">
                {headline.title}
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              — {headline.source}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
