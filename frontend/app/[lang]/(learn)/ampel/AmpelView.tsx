"use client";

// Client-Teil der Ampel-Seite (page.tsx bleibt Server-Komponente wegen
// `metadata`). Das Portfolio kommt ausschließlich aus den Depot-
// Positionen (FRONTEND_DECISIONS §4) — kein eigenes Eingabeformular,
// keine erneute Nutzerabfrage.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { ErrorNotice } from "@/components/ErrorNotice";
import { ReportDownloadButton } from "@/components/ReportDownloadButton";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, postRiskAmpel, postRiskCorrelation } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/de";
import { formatDecimal, formatPercent } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ampelTitle } from "@/lib/i18n/labels";
import { LocaleLink } from "@/lib/i18n/link";
import { canonicalWeights, derivePortfolioWeights } from "@/lib/portfolio";
import type { AmpelOut, AmpelStatus, PositionValueOut } from "@/lib/types";

export function AmpelView() {
  const {
    depot,
    valuation,
    isValuationLoading,
    valuationError,
    refetchValuation,
  } = useDepot();
  const { dict } = useI18n();

  // Depot noch nicht aus localStorage gelesen (usePaperDepot §2-SSR-Gotcha).
  if (depot === null) {
    return (
      <section className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <AmpelCardsSkeleton />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-[74ch] flex-col gap-2">
        <div className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
          {dict.ampel.kicker}
        </div>
        <h1 className="font-serif text-[34px] leading-[1.1] font-normal">
          {dict.ampel.title}
        </h1>
        <p className="text-[14.5px] leading-relaxed text-soft">
          {dict.ampel.subtitle}
        </p>
      </div>

      <AmpelContent
        hasTransactions={depot.transactions.length > 0}
        isValuationLoading={isValuationLoading}
        valuationError={valuationError}
        positions={valuation?.positions}
        onRetryValuation={refetchValuation}
      />
    </section>
  );
}

function AmpelContent({
  hasTransactions,
  isValuationLoading,
  valuationError,
  positions,
  onRetryValuation,
}: {
  hasTransactions: boolean;
  isValuationLoading: boolean;
  valuationError: ApiError | null;
  positions: PositionValueOut[] | undefined;
  onRetryValuation: () => void;
}) {
  if (!hasTransactions) {
    return <EmptyHint />;
  }

  if (valuationError) {
    return <ErrorNotice error={valuationError} onRetry={onRetryValuation} />;
  }

  if (isValuationLoading || positions === undefined) {
    return <AmpelCardsSkeleton />;
  }

  if (positions.length === 0) {
    return <EmptyHint />;
  }

  return <AmpelResult positions={positions} />;
}

function EmptyHint() {
  const { dict } = useI18n();

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-elevated">
      <h2 className="text-lg font-semibold">{dict.ampel.emptyTitle}</h2>
      <p className="mt-1 text-sm text-muted">{dict.ampel.emptyBody}</p>
      <LocaleLink
        href="/depot"
        className="mt-3 inline-block rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg no-underline"
      >
        {dict.common.goToDepot}
      </LocaleLink>
    </div>
  );
}

function AmpelResult({ positions }: { positions: PositionValueOut[] }) {
  const { dict, locale } = useI18n();
  const weights = derivePortfolioWeights(positions);

  const ampelQuery = useQuery({
    queryKey: ["risk", "ampel", canonicalWeights(weights)],
    queryFn: () => postRiskAmpel({ portfolio: { weights } }),
  });

  if (ampelQuery.error instanceof ApiError) {
    return (
      <ErrorNotice
        error={ampelQuery.error}
        onRetry={() => ampelQuery.refetch()}
      />
    );
  }

  if (ampelQuery.isPending || !ampelQuery.data) {
    return <AmpelCardsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* I18N_DECISIONS.md §5: explanation/lesson kommen unübersetzt vom
          Backend (Phase-2-Frage) — dieser Hinweis macht das im
          englischen UI ehrlich statt wie ein Bug wirken zu lassen. */}
      {locale !== "de" && (
        <p className="text-xs text-faint italic">{dict.ampel.germanOnlyNotice}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {ampelQuery.data.ampeln.map((ampel) => (
          <AmpelCard key={ampel.id} ampel={ampel} locale={locale} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
        <ReportDownloadButton portfolio={{ weights }} />
      </div>

      <CorrelationSection weights={weights} positionCount={positions.length} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-sunken px-4 py-3 text-sm">
        <span className="text-soft">{dict.ampel.stressLinkText}</span>
        <LocaleLink
          href="/stress"
          className="shrink-0 rounded-md border border-border px-3 py-1 font-medium text-soft no-underline transition-colors hover:border-border-strong hover:text-ink"
        >
          {dict.ampel.stressLinkCta}
        </LocaleLink>
      </div>
    </div>
  );
}

function CorrelationSection({
  weights,
  positionCount,
}: {
  weights: Record<string, number>;
  positionCount: number;
}) {
  const { dict } = useI18n();

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-elevated">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-semibold">
          {dict.ampel.correlation.title}
        </h2>
        <span className="max-w-[62ch] text-xs text-muted">
          {dict.ampel.correlation.explanation}
        </span>
      </div>

      {positionCount < 2 ? (
        <p className="mt-3 text-sm text-muted">
          {dict.ampel.correlation.needsTwoPositions}
        </p>
      ) : (
        <div className="mt-4">
          <CorrelationResult weights={weights} />
        </div>
      )}
    </div>
  );
}

function CorrelationResult({ weights }: { weights: Record<string, number> }) {
  const correlationQuery = useQuery({
    queryKey: ["risk", "correlation", canonicalWeights(weights)],
    queryFn: () => postRiskCorrelation({ portfolio: { weights } }),
  });

  if (correlationQuery.error instanceof ApiError) {
    return (
      <ErrorNotice
        error={correlationQuery.error}
        onRetry={() => correlationQuery.refetch()}
      />
    );
  }

  if (correlationQuery.isPending || !correlationQuery.data) {
    return <Skeleton className="h-48 w-full" />;
  }

  return <CorrelationHeatmap {...correlationQuery.data} />;
}

const STATUS_ORDER: AmpelStatus[] = ["red", "yellow", "green"];

const LAMP_ON_VAR: Record<AmpelStatus, string> = {
  red: "var(--alert)",
  yellow: "var(--warn)",
  green: "var(--ok)",
};

const LAMP_OFF_VAR: Record<AmpelStatus, string> = {
  red: "var(--lamp-off-r)",
  yellow: "var(--lamp-off-y)",
  green: "var(--lamp-off-g)",
};

const STATUS_ICON: Record<AmpelStatus, string> = {
  green: "✓",
  yellow: "!",
  red: "✕",
};

const STATUS_TINT: Record<AmpelStatus, string> = {
  green: "var(--ok-tint)",
  yellow: "var(--warn-tint)",
  red: "var(--alert-tint)",
};

const STATUS_INK: Record<AmpelStatus, string> = {
  green: "var(--ok)",
  yellow: "var(--warn)",
  red: "var(--alert)",
};

function AmpelLamp({ status }: { status: AmpelStatus }) {
  return (
    <div
      className="flex flex-none flex-col gap-[7px] rounded-[11px] p-2"
      style={{ background: "var(--housing)" }}
    >
      {STATUS_ORDER.map((lamp) => {
        const isOn = lamp === status;
        return (
          <div
            key={lamp}
            className="h-[22px] w-[22px] rounded-full transition-[background-color,box-shadow] duration-500"
            style={{
              background: isOn ? LAMP_ON_VAR[lamp] : LAMP_OFF_VAR[lamp],
              boxShadow: isOn
                ? `0 0 12px 2px color-mix(in srgb, ${LAMP_ON_VAR[lamp]} 55%, transparent)`
                : "none",
              animation: isOn ? "lampGlow 2.4s ease-in-out infinite" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function ampelReading(
  ampel: AmpelOut,
  locale: Locale,
  readings: Dictionary["ampel"]["readings"],
): string {
  if (ampel.id === "volatility") {
    return readings.volatility(formatPercent(ampel.value, locale, 1));
  }
  if (ampel.id === "diversification") {
    return readings.diversification(formatDecimal(ampel.value, locale, 2));
  }
  return readings.concentration(formatDecimal(ampel.value, locale, 2));
}

function AmpelCard({ ampel, locale }: { ampel: AmpelOut; locale: Locale }) {
  const { dict } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const statusLabel = dict.ampel.statusLabels[ampel.status];
  const title = ampelTitle(ampel.id, ampel.title, locale);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface shadow-elevated">
      <div className="flex gap-4 p-5">
        <AmpelLamp status={ampel.status} />
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[15.5px] leading-tight font-semibold">
            {title}
          </h2>
          <div
            className="inline-flex w-fit items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 transition-colors duration-500"
            style={{
              background: STATUS_TINT[ampel.status],
              color: STATUS_INK[ampel.status],
            }}
          >
            <span className="text-[11px] leading-none font-bold" aria-hidden="true">
              {STATUS_ICON[ampel.status]}
            </span>
            <span className="text-xs font-semibold tracking-[0.01em]">
              {statusLabel}
            </span>
          </div>
          <div className="font-mono text-[12.5px] text-soft">
            {ampelReading(ampel, locale, dict.ampel.readings)}
          </div>
        </div>
      </div>
      <div className="px-5 pb-4">
        <p className="text-[13.5px] leading-relaxed text-soft">
          {ampel.explanation}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="mx-5 mb-5 flex items-center justify-between gap-2.5 rounded-md border border-border bg-sunken px-3 py-2 text-[12.5px] text-soft transition-colors hover:border-border-strong hover:text-ink"
      >
        <span>{dict.common.whatDoesThisMean}</span>
        <span
          className={`font-mono transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      {isOpen && (
        <div className="rounded-b-xl border-t border-border bg-sunken px-5 pt-4 pb-5">
          <p className="text-[13.5px] leading-relaxed text-soft">
            {ampel.lesson}
          </p>
        </div>
      )}
    </div>
  );
}

function AmpelCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
