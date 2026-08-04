// NxN-Heatmap für POST /risk/correlation. Farbe allein reicht nie als
// Information (Barrierefreiheit) — jede Zelle zeigt zusätzlich den
// gerundeten Zahlenwert. Buckets statt Farbverlauf: sieben feste
// Tailwind-Klassenpaare (bg-*/dark:bg-*), dasselbe Muster wie die
// Ampel-Badges in AmpelView.tsx — dadurch funktioniert Dark Mode
// garantiert, ohne einen eigenen Farb-Interpolationscode zu schreiben
// (anders als die hartkodierte Recharts-Stroke-Farbe im Stress-Chart,
// die im Dark Mode unsichtbar wird).
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CorrelationOut } from "@/lib/types";

interface Bucket {
  min: number;
  className: string;
}

const BUCKETS: Bucket[] = [
  { min: 0.7, className: "bg-red-600 text-white dark:bg-red-500 dark:text-slate-950" },
  {
    min: 0.4,
    className: "bg-red-300 text-red-950 dark:bg-red-800 dark:text-red-50",
  },
  {
    min: 0.15,
    className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
  {
    min: -0.15,
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  {
    min: -0.4,
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  {
    min: -0.7,
    className:
      "bg-emerald-300 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-50",
  },
  {
    min: -Infinity,
    className: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950",
  },
];

function classForValue(value: number): string {
  return (BUCKETS.find((bucket) => value >= bucket.min) ?? BUCKETS[BUCKETS.length - 1])
    .className;
}

export function CorrelationHeatmap({ tickers, matrix }: CorrelationOut) {
  const { dict } = useI18n();

  return (
    <div className="overflow-x-auto">
      <table
        className="border-separate border-spacing-1 text-xs"
        aria-label={dict.ampel.correlation.tableAriaLabel}
      >
        <caption className="sr-only">
          {dict.ampel.correlation.tableCaption}
        </caption>
        <thead>
          <tr>
            <th scope="col" />
            {tickers.map((ticker) => (
              <th
                key={ticker}
                scope="col"
                className="px-1 pb-1 text-center font-medium text-slate-600 dark:text-slate-300"
              >
                {ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowTicker, i) => (
            <tr key={rowTicker}>
              <th
                scope="row"
                className="pr-2 text-right font-medium text-slate-600 dark:text-slate-300"
              >
                {rowTicker}
              </th>
              {matrix[i].map((value, j) => (
                <td
                  key={tickers[j]}
                  className={`h-10 w-10 rounded text-center align-middle tabular-nums ${classForValue(value)}`}
                >
                  {value.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
