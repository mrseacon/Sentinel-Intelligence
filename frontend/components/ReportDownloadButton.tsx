"use client";

// PDF-Export des Risiko-Reports (POST /reports/risk-summary). Wird sowohl
// von /analyze (frei zusammengestelltes Portfolio) als auch von /ampel
// (Depot-abgeleitetes Portfolio) mit unterschiedlichen `portfolio`-Objekten
// verwendet — die Logik ist identisch, nur die Gewichte-Quelle unterscheidet
// sich, daher hier als gemeinsame Komponente statt zweimal implementiert.
import { useMutation } from "@tanstack/react-query";

import { ErrorNotice } from "@/components/ErrorNotice";
import { ApiError, postReportRiskSummary } from "@/lib/api";
import type { PortfolioIn } from "@/lib/types";

export function ReportDownloadButton({
  portfolio,
}: {
  portfolio: PortfolioIn;
}) {
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {mutation.isPending && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"
          />
        )}
        {mutation.isPending
          ? "Report wird erstellt…"
          : "Als PDF-Report herunterladen"}
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
