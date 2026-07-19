import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stress-Test" };

export default function StressPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Historischer Stress-Test</h1>
      <p className="text-slate-600 dark:text-slate-300">
        Hier entsteht die Preset-Auswahl (z.&nbsp;B. Finanzkrise 2008,
        Corona-Crash 2020) samt Verlaufskurve in der nächsten Bau-Phase.
      </p>
    </section>
  );
}
