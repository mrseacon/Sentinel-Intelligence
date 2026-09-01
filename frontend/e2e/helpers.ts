import type { Page } from "@playwright/test";

/**
 * Geteilte Hilfsfunktion für Testfälle, die ein befülltes Depot
 * brauchen (Ampel, Stress-Test, Simulation, PDF-Report): navigiert
 * direkt mit `?demo=1` auf die Zielseite statt erst manuell zu traden
 * (Aufgabenstellung Testfall b: "z.B. via Demo-Modus"). DepotProvider
 * liest den Query-Param unabhängig davon, welche (learn)-Seite zuerst
 * mountet (lib/DepotProvider.tsx), daher funktioniert das auf jeder
 * Route unter (learn), nicht nur /depot.
 */
export async function gotoWithDemoPortfolio(page: Page, path: string) {
  await page.goto(`${path}?demo=1`);
}
