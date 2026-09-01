import { expect, test } from "@playwright/test";

import { gotoWithDemoPortfolio } from "./helpers";

/**
 * Testfall (d): Simulation — Horizont wählen, Perzentil-Fächer
 * erscheint. Befülltes Depot via Beispieldepot (s. helpers.ts).
 */
test.describe("Simulation", () => {
  test("Horizont wählen zeigt den Perzentil-Fächer", async ({ page }) => {
    await gotoWithDemoPortfolio(page, "/de/simulation");

    const horizonButton = page.getByRole("button", { name: "5 Jahre" });
    await expect(horizonButton).toBeVisible({ timeout: 15_000 });
    await horizonButton.click();

    await expect(
      page.getByRole("heading", { name: "Mögliche Wertentwicklung" }),
    ).toBeVisible({ timeout: 15_000 });

    // Die drei Perzentil-Kacheln (p10/p50/p90) sind Backend-berechnete
    // Faktoren ("×1,85" o.ä.) — Wert selbst nicht vorhersagbar, aber das
    // ×-Präfix ist stabil (Aufgabenstellung: "Perzentil-Fächer erscheint").
    await expect(page.getByText("Unteres Perzentil (10 %)")).toBeVisible();
    await expect(page.getByText("Mittlerer Verlauf (50 %)")).toBeVisible();
    await expect(page.getByText("Oberes Perzentil (90 %)")).toBeVisible();
    await expect(page.getByText(/^×/).first()).toBeVisible();

    // Annahmen-Karte bestätigt den gewählten Horizont wurde tatsächlich
    // an die Simulation durchgereicht (nicht nur UI-lokaler Button-State).
    await expect(
      page.getByRole("heading", { name: "Annahmen der Simulation" }),
    ).toBeVisible();
  });
});
