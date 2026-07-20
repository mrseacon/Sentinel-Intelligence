import type { Metadata } from "next";

import { StressView } from "./StressView";

export const metadata: Metadata = { title: "Stress-Test" };

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in StressView (Client, braucht useDepot()/Hooks), gleiches Muster wie
// ampel/page.tsx.
export default function StressPage() {
  return <StressView />;
}
