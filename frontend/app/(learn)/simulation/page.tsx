import type { Metadata } from "next";

export const metadata: Metadata = { title: "Simulation" };

export default function SimulationPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Zukunftssimulation</h1>
      <p className="text-slate-600 dark:text-slate-300">
        Hier entsteht die Horizont-Wahl (1/5/10 Jahre) samt
        Perzentil-Fächer in der nächsten Bau-Phase.
      </p>
    </section>
  );
}
