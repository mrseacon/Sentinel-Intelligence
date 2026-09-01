import { expect, test } from "@playwright/test";

/**
 * Testfall (h): Sprachumschalter DE->EN, Kern-UI-Text ändert sich
 * sichtbar. Landing-Page, weil dort sowohl Marketing- als auch reiner
 * UI-Text (Nav) in einem Blick geprüft werden kann.
 */
test.describe("Sprachumschalter", () => {
  test("DE nach EN wechselt sichtbaren Kerntext", async ({ page }) => {
    await page.goto("/de");

    await expect(
      page.getByRole("heading", { name: "Verstehen statt raten." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Kostenlos starten" }).first(),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Switch to English" })
      .click();

    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(
      page.getByRole("heading", { name: "Understand, don't guess." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start for free" }).first(),
    ).toBeVisible();
    // Deutscher Text darf nicht mehr da sein — kein Sprachmix.
    await expect(
      page.getByRole("heading", { name: "Verstehen statt raten." }),
    ).not.toBeVisible();
  });
});
