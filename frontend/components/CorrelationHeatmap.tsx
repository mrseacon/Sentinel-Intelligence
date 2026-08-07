// NxN-Heatmap für POST /risk/correlation. Farbe allein reicht nie als
// Information (Barrierefreiheit) — jede Zelle zeigt zusätzlich den
// gerundeten Zahlenwert UND ein Glyph, das sich in der Legende
// wiederfindet. Fünf feste Buckets (Theme-Tokens --corr-1..4/--corr-neg
// aus globals.css) statt Farbverlauf — dadurch funktioniert Dark Mode
// garantiert, ohne eigenen Farb-Interpolationscode zu schreiben (anders
// als die hartkodierte Recharts-Stroke-Farbe im Stress-Chart, die im
// Dark Mode unsichtbar wird).
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CorrelationOut } from "@/lib/types";

interface Bucket {
  min: number;
  bg: string;
  ink: string;
  glyph: string;
}

const BUCKETS: Bucket[] = [
  { min: 0.7, bg: "var(--corr-4)", ink: "var(--corr-ink-4)", glyph: "▲▲▲" },
  { min: 0.4, bg: "var(--corr-3)", ink: "var(--corr-ink-3)", glyph: "▲▲" },
  { min: 0.15, bg: "var(--corr-2)", ink: "var(--corr-ink-2)", glyph: "▲" },
  { min: -0.15, bg: "var(--corr-1)", ink: "var(--corr-ink-1)", glyph: "•" },
  { min: -Infinity, bg: "var(--corr-neg)", ink: "var(--corr-ink-neg)", glyph: "▽" },
];

function bucketForValue(value: number): Bucket {
  return BUCKETS.find((bucket) => value >= bucket.min) ?? BUCKETS[BUCKETS.length - 1];
}

export function CorrelationHeatmap({ tickers, matrix }: CorrelationOut) {
  const { dict } = useI18n();

  return (
    <div className="flex flex-col gap-4">
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
                  className="px-1 pb-1 text-center font-mono font-medium tracking-[0.04em] text-muted"
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
                  className="pr-2 text-right font-mono font-medium tracking-[0.04em] text-muted"
                >
                  {rowTicker}
                </th>
                {matrix[i].map((value, j) => {
                  const bucket = bucketForValue(value);
                  return (
                    <td
                      key={tickers[j]}
                      className="h-12 w-14 rounded-md text-center align-middle"
                      style={{ background: bucket.bg, color: bucket.ink }}
                    >
                      <div className="font-mono text-[13px] tracking-[-0.01em] tabular-nums">
                        {value.toFixed(2)}
                      </div>
                      <div className="text-[10px] opacity-90" aria-hidden="true">
                        {bucket.glyph}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3.5">
        {dict.ampel.correlation.legend.map((entry) => (
          <div key={entry.label} className="flex items-center gap-1.5 text-xs text-soft">
            <span
              className="h-3 w-5 rounded border border-border"
              style={{ background: bucketForLegend(entry.glyph).bg }}
            />
            <span className="font-mono text-[11px]" aria-hidden="true">
              {entry.glyph}
            </span>
            <span>{entry.label}</span>
            <span className="font-mono text-[11px] text-faint">{entry.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function bucketForLegend(glyph: string): Bucket {
  return BUCKETS.find((bucket) => bucket.glyph === glyph) ?? BUCKETS[BUCKETS.length - 1];
}
