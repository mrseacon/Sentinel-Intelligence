import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ampel" };

export default function AmpelPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Risiko-Ampel</h1>
      <p className="text-slate-600 dark:text-slate-300">
        Hier entstehen die drei Ampeln (Klumpenrisiko, Diversifikation,
        Volatilität) samt Score in der nächsten Bau-Phase.
      </p>
    </section>
  );
}
