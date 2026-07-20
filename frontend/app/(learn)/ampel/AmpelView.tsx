"use client";

// Client-Teil der Ampel-Seite (page.tsx bleibt Server-Komponente wegen
// `metadata`). Das Portfolio kommt ausschließlich aus den Depot-
// Positionen (FRONTEND_DECISIONS §4) — kein eigenes Eingabeformular,
// keine erneute Nutzerabfrage.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, postRiskAmpel } from "@/lib/api";
import { useDepot } from "@/lib/DepotProvider";
import { canonicalWeights, derivePortfolioWeights } from "@/lib/portfolio";
import type { AmpelOut, AmpelStatus, PositionValueOut } from "@/lib/types";

export function AmpelView() {
  const { depot, valuation, isValuationLoading, valuationError } =
    useDepot();

  // Depot noch nicht aus localStorage gelesen (usePaperDepot §2-SSR-Gotcha).
  if (depot === null) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <AmpelCardsSkeleton />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Risiko-Ampel</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Drei Ampeln auf Basis deiner aktuellen Depot-Positionen:
          Klumpenrisiko, Diversifikation und Volatilität.
        </p>
      </div>

      <AmpelContent
        hasTransactions={depot.transactions.length > 0}
        isValuationLoading={isValuationLoading}
        valuationError={valuationError}
        positions={valuation?.positions}
      />
    </section>
  );
}

function AmpelContent({
  hasTransactions,
  isValuationLoading,
  valuationError,
  positions,
}: {
  hasTransactions: boolean;
  isValuationLoading: boolean;
  valuationError: ApiError | null;
  positions: PositionValueOut[] | undefined;
}) {
  if (!hasTransactions) {
    return <EmptyHint />;
  }

  if (valuationError) {
    return <ErrorNotice error={valuationError} />;
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
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Noch keine Positionen</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Die Ampel braucht ein Depot mit mindestens einer Position. Starte
        auf der Depot-Seite mit deinem ersten Trade.
      </p>
      <Link
        href="/depot"
        className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Zum Depot
      </Link>
    </div>
  );
}

function AmpelResult({ positions }: { positions: PositionValueOut[] }) {
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {ampelQuery.data.ampeln.map((ampel) => (
          <AmpelCard key={ampel.id} ampel={ampel} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="text-slate-600 dark:text-slate-300">
          Wie hätte sich dein Depot in einer vergangenen Krise geschlagen?
        </span>
        <Link
          href="/stress"
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Zum Stress-Test
        </Link>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<
  AmpelStatus,
  { label: string; icon: string; badge: string; border: string }
> = {
  green: {
    label: "Grün",
    icon: "✓",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    border: "border-l-emerald-500",
  },
  yellow: {
    label: "Gelb",
    icon: "!",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    border: "border-l-amber-500",
  },
  red: {
    label: "Rot",
    icon: "✕",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    border: "border-l-red-500",
  },
};

function AmpelCard({ ampel }: { ampel: AmpelOut }) {
  const style = STATUS_STYLES[ampel.status];

  return (
    <div
      className={`space-y-3 rounded-lg border border-slate-200 border-l-4 p-4 dark:border-slate-800 ${style.border}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{ampel.title}</h3>
        {/* Status nie nur über Farbe: Icon + Wort daneben. */}
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
        >
          <span aria-hidden="true">{style.icon}</span>
          {style.label}
        </span>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-200">
        {ampel.explanation}
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
          Was heißt das?
        </summary>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {ampel.lesson}
        </p>
      </details>
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
