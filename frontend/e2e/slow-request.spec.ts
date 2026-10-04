import { expect, test } from "@playwright/test";

/**
 * Langsame Anfrage (>8 s, z.B. Cold-Start des Free-Tier-Backends) ->
 * freundlicher Hinweis, der nach der Antwort wieder verschwindet.
 *
 * Wie in error-handling.spec.ts: kein Response-Mocking. page.route()
 * hält den echten Request nur zurück und lässt ihn dann unverändert
 * weiterlaufen (route.continue) — das Backend antwortet real, nur eben
 * "verspätet", genau wie bei einem aufwachenden Free-Tier-Server.
 */
test("Hinweis erscheint bei langsamer Anfrage und verschwindet danach", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await page.route("**/paper/valuation", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await route.continue();
  });

  await page.goto("/de/depot?demo=1");

  const hint = page.getByRole("status").filter({ hasText: "Backend startet" });
  await expect(hint).toBeVisible({ timeout: 15_000 });
  await expect(hint).toContainText("bis zu einer Minute");

  // Antwort kommt -> Hinweis weg, echter Inhalt da.
  await expect(hint).not.toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Größte: AAPL")).toBeVisible({ timeout: 15_000 });
});

test("English: hint text is localized", async ({ page }) => {
  test.setTimeout(60_000);

  await page.route("**/paper/valuation", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await route.continue();
  });

  await page.goto("/en/depot?demo=1");

  await expect(
    page.getByRole("status").filter({ hasText: "backend is starting up" }),
  ).toBeVisible({ timeout: 15_000 });
});
