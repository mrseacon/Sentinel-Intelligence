"use client";

// PDF-Export des Risiko-Reports (POST /reports/risk-summary). Wird sowohl
// von /analyze (frei zusammengestelltes Portfolio) als auch von /ampel
// (Depot-abgeleitetes Portfolio) mit unterschiedlichen `portfolio`-Objekten
// verwendet — die Logik ist identisch, nur die Gewichte-Quelle unterscheidet
// sich, daher hier als gemeinsame Komponente statt zweimal implementiert.
import { useMutation } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { ApiError, postReportRiskSummary } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PortfolioIn } from "@/lib/types";

export function ReportDownloadButton({
  portfolio,
}: {
  portfolio: PortfolioIn;
}) {
  const { dict } = useI18n();
  const mutation = useMutation({
    mutationFn: () => postReportRiskSummary(portfolio),
    onSuccess: (blob) => {
      // Kein <a href> auf eine URL — der Blob existiert nur im Speicher,
      // daher der klassische createObjectURL-Trick für einen sofortigen
      // Download ohne Navigation weg von der Seite.
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sentinel-risiko-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3.5 py-2 text-[13px] text-soft transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40"
      >
        {mutation.isPending ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M8 1.5v8.5m0 0 3-3m-3 3-3-3M2.5 13h11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {mutation.isPending
          ? dict.reportDownload.creating
          : dict.reportDownload.download}
      </button>

      {mutation.error instanceof ApiError && (
        <ErrorNotice
          error={mutation.error}
          onRetry={() => mutation.mutate()}
        />
      )}
    </div>
  );
}
