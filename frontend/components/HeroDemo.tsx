"use client";

// Interaktive Hero-Demo (Landing-Page): rein simulierte Portfolio-
// Gewichtung über drei Beispiel-Bereiche, keine Backend-Anbindung.
// Die Klumpenrisiko-Schwellen (40 % / 60 % größte Position) sind bewusst
// so gewählt, dass sie den echten AMPEL_HHI-Schwellen aus
// sentinel_core/constants.py entsprechen: Für ein realistisch großes
// Depot (viele kleine Positionen neben einer dominanten) gilt
// HHI ≈ p² für den Anteil p der größten Position. p² = 0.15 (Grün-
// Grenze) ergibt p ≈ 39 %, p² = 0.30 (Gelb-Grenze) ergibt p ≈ 55 % —
// die hier verwendeten 40 %/60 % sind die naheliegenden runden Werte
// dieser Ableitung, keine frei erfundene Demo-Schwelle. Bei nur drei
// Positionen (wie in dieser vereinfachten Demo) liegt der exakte HHI-
// Wert selbst im ausgewogensten Fall bereits über der echten Gelb-
// Grenze; die Schwellen hier gelten deshalb für den Anteil der größten
// Position, nicht für den rohen HHI von genau drei Buckets.
import { useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";

const SECTOR_KEYS = ["tech", "energie", "anleihen"] as const;
type SectorKey = (typeof SECTOR_KEYS)[number];

const DEFAULT_MIX: [number, number, number] = [55, 20, 25];

type Level = "green" | "yellow" | "red";

const STATUS_ICON: Record<Level, string> = { green: "✓", yellow: "!", red: "✕" };
const STATUS_TINT: Record<Level, string> = {
  green: "var(--ok-tint)",
  yellow: "var(--warn-tint)",
  red: "var(--alert-tint)",
};
const STATUS_INK: Record<Level, string> = {
  green: "var(--ok)",
  yellow: "var(--warn)",
  red: "var(--alert)",
};

function levelFor(topShare: number): Level {
  if (topShare >= 60) return "red";
  if (topShare >= 40) return "yellow";
  return "green";
}

export function HeroDemo() {
  const { dict } = useI18n();
  const t = dict.landing.heroDemo;
  const [mix, setMix] = useState<[number, number, number]>(DEFAULT_MIX);

  function setSlot(index: number, rawValue: number) {
    const value = Math.max(0, Math.min(100, Math.round(rawValue)));
    setMix((prev) => {
      const others = [0, 1, 2].filter((i) => i !== index) as [number, number];
      const rest = 100 - value;
      const sumOthers = prev[others[0]] + prev[others[1]];
      let a: number;
      if (sumOthers <= 0) {
        a = Math.round(rest / 2);
      } else {
        a = Math.round(rest * (prev[others[0]] / sumOthers));
      }
      a = Math.max(0, Math.min(rest, a));
      const next: [number, number, number] = [...prev];
      next[index] = value;
      next[others[0]] = a;
      next[others[1]] = rest - a;
      return next;
    });
  }

  const top = Math.max(...mix);
  const topIndex = mix.indexOf(top);
  const topSectorKey: SectorKey = SECTOR_KEYS[topIndex];
  const topName = t.sectors[topSectorKey];
  const level = levelFor(top);

  const text =
    level === "red"
      ? t.textRed(topName, top)
      : level === "yellow"
        ? t.textYellow(topName, top)
        : t.textGreen(top);

  const lesson =
    level === "red" ? t.lessonRed : level === "yellow" ? t.lessonYellow : t.lessonGreen;

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface p-6 text-left shadow-elevated sm:p-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-5">
          {SECTOR_KEYS.map((key, index) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor={`hero-slider-${key}`} className="font-medium text-ink">
                  {t.sectors[key]}
                </label>
                <span className="font-mono text-xs text-muted">
                  {mix[index]}&nbsp;%
                </span>
              </div>
              <input
                id={`hero-slider-${key}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={mix[index]}
                aria-valuetext={t.ariaValueText(mix[index])}
                onChange={(e) => setSlot(index, Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMix(DEFAULT_MIX)}
            className="text-xs font-medium text-muted hover:underline"
          >
            {t.reset}
          </button>
        </div>

        <div
          aria-live="polite"
          className="flex flex-col justify-center gap-3 border-t border-border pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8"
        >
          <span className="font-mono text-[11px] tracking-wide text-faint uppercase">
            {t.concentrationLabel}
          </span>
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: STATUS_TINT[level], color: STATUS_INK[level] }}
          >
            <span aria-hidden="true">{STATUS_ICON[level]}</span>
            {dict.ampel.statusLabels[level]}
          </span>
          <p className="text-sm text-soft">{text}</p>
          <p className="text-xs text-muted">{lesson}</p>
          <span className="text-xs text-faint">{t.liveHint}</span>
        </div>
      </div>
    </div>
  );
}
