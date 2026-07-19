import type { Metadata } from "next";

export const metadata: Metadata = { title: "Depot" };

export default function DepotPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dein Paper-Depot</h1>
      <p className="text-slate-600 dark:text-slate-300">
        Hier entstehen Positionen, Cash-Stand und der Trade-Dialog in der
        nächsten Bau-Phase.
      </p>
    </section>
  );
}
