import type { Metadata } from "next";

import { AmpelView } from "./AmpelView";

export const metadata: Metadata = { title: "Ampel" };

// Server-Komponente wegen `metadata` (App Router erlaubt export const
// metadata nicht in "use client"-Dateien) — die eigentliche Logik lebt
// in AmpelView (Client, braucht useDepot()/Hooks).
export default function AmpelPage() {
  return <AmpelView />;
}
