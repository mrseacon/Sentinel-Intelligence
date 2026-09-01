import { expect, test } from "@playwright/test";

import { gotoWithDemoPortfolio } from "./helpers";

/**
 * Testfall (c): Stress-Test — Preset auswählen, Chart erscheint,
 * Kennzahlen sichtbar. Befülltes Depot via Beispieldepot (s. helpers.ts).
 */
test.describe("Stress-Test", () => {
  test("Preset auswählen zeigt Chart und Kennzahlen", async ({ page }) => {
    await gotoWithDemoPortfolio(page, "/de/stress");

    const preset = page.getByRole("button", { name: /Finanzkrise/ });
    await expect(preset).toBeVisible({ timeout: 15_000 });
    await preset.click();

    // Chart-Karte (Recharts <svg>, kein eigenes ARIA-Label) — die
    // umgebende Überschrift ist der stabile Anker.
    await expect(
      page.getByRole("heading", { name: "Depotwert im Krisenverlauf" }),
    ).toBeVisible({ timeout: 15_000 });

    // Die drei Kennzahlen-Kacheln sind Backend-berechnete Werte, nicht
    // vorhersagbar auf den Prozentpunkt genau — hier zählt nur, dass sie
    // mit einem echten Wert (statt Skeleton/Fehler) gerendert werden.
    // StatCard.tsx: Label-<p> und Wert-<p> sind direkte Geschwister,
    // "xpath=following-sibling::p[1]" holt exakt den Wert daneben (statt
    // über den vollen Elternknoten zu scopen, der auf dieser Seite auch
    // Chart-Achsenbeschriftungen mit "%" enthält).
    for (const label of [
      "Maximaler Drawdown",
      "Rendite im Zeitraum",
      "Volatilität im Zeitraum",
    ]) {
      const value = page
        .getByText(label, { exact: true })
        .locator("xpath=following-sibling::p[1]");
      await expect(value).toHaveText(/%/);
    }
  });
});
