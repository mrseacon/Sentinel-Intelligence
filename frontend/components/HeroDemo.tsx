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

interface Sector {
  key: string;
  label: string;
}

const SECTORS: Sector[] = [
  { key: "tech", label: "Technologie" },
  { key: "energie", label: "Energie" },
  { key: "anleihen", label: "Anleihen" },
];

const DEFAULT_MIX: [number, number, number] = [55, 20, 25];

type Level = "green" | "yellow" | "red";

const STATUS_STYLES: Record<
  Level,
  { label: string; icon: string; badge: string }
> = {
  green: {
    label: "Grün",
    icon: "✓",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  yellow: {
    label: "Gelb",
    icon: "!",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  red: {
    label: "Rot",
    icon: "✕",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
};

function levelFor(topShare: number): Level {
  if (topShare >= 60) return "red";
  if (topShare >= 40) return "yellow";
  return "green";
}

export function HeroDemo() {
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
  const topName = SECTORS[topIndex].label;
  const level = levelFor(top);
  const style = STATUS_STYLES[level];

  const text =
    level === "red"
      ? `${topName} macht ${top} Prozent aus. Ein einzelner Bereich bestimmt damit fast dein ganzes Ergebnis.`
      : level === "yellow"
        ? `${topName} wiegt mit ${top} Prozent deutlich schwerer als der Rest. Dein Depot folgt vor allem diesem Bereich.`
        : `Kein Bereich kommt über ${top} Prozent. Die Last ist auf alle drei Bereiche verteilt.`;

  const lesson =
    level === "red"
      ? "Bei dieser Konzentration entscheidet die Entwicklung eines Sektors über dein Depot. Gewinne und Verluste fallen entsprechend groß aus."
      : level === "yellow"
        ? "Eine Übergewichtung kann bewusst gewollt sein. Wichtig ist, dass du weißt, welchen Teil deines Ergebnisses sie bestimmt."
        : "Bei ausgewogener Verteilung zieht ein schwacher Bereich das Depot nur anteilig nach unten. Das schützt nicht vor Verlusten, dämpft sie aber.";

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/60 p-6 text-left shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 sm:p-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-5">
          {SECTORS.map((sector, index) => (
            <div key={sector.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label
                  htmlFor={`hero-slider-${sector.key}`}
                  className="font-medium text-slate-700 dark:text-slate-200"
                >
                  {sector.label}
                </label>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {mix[index]}&nbsp;%
                </span>
              </div>
              <input
                id={`hero-slider-${sector.key}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={mix[index]}
                aria-valuetext={`${mix[index]} Prozent`}
                onChange={(e) => setSlot(index, Number(e.target.value))}
                className="w-full accent-slate-900 dark:accent-slate-100"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMix(DEFAULT_MIX)}
            className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
          >
            Zurücksetzen
          </button>
        </div>

        <div
          aria-live="polite"
          className="flex flex-col justify-center gap-3 border-t border-slate-200 pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8 dark:border-slate-800"
        >
          <span className="font-mono text-[11px] tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Klumpenrisiko
          </span>
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${style.badge}`}
          >
            <span aria-hidden="true">{style.icon}</span>
            {style.label}
          </span>
          <p className="text-sm text-slate-700 dark:text-slate-200">{text}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lesson}
          </p>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Genau das siehst du live in deinem eigenen Depot.
          </span>
        </div>
      </div>
    </div>
  );
}
