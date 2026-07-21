import type { Metadata } from "next";

import { SimulationView } from "./SimulationView";

export const metadata: Metadata = { title: "Simulation" };

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in SimulationView (Client, braucht useDepot()/Hooks), gleiches Muster
// wie ampel/page.tsx und stress/page.tsx.
export default function SimulationPage() {
  return <SimulationView />;
}
