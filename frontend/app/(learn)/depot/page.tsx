import type { Metadata } from "next";

import { DepotView } from "./DepotView";

export const metadata: Metadata = { title: "Depot" };

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in DepotView (Client, braucht useDepot()/Hooks).
export default function DepotPage() {
  return <DepotView />;
}
