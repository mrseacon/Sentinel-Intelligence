import { expect, test } from "@playwright/test";

/**
 * Testfall (i): Backend nicht erreichbar -> ErrorNotice mit Retry.
 *
 * Bewusst NICHT über eine falsche NEXT_PUBLIC_API_URL im Testlauf (wie
 * die Aufgabenstellung als eine Option nennt): NEXT_PUBLIC_*-Variablen
 * werden beim Next-Build inlined (playwright.config.ts), eine falsche
 * URL hätte also einen zweiten kompletten Frontend-Build+Server nur für
 * diesen einen negativen Testfall gebraucht. Stattdessen: page.route()
 * bricht genau den einen Request ab, den lib/api.ts's echter
 * fetch()-Call auch bei einem wirklich unerreichbaren Backend sehen
 * würde (Netzwerkfehler -> derselbe Code-Pfad, derselbe ApiError(503,
 * UPSTREAM_UNAVAILABLE) wie ein echter Verbindungsabbruch). Kein
 * Response-Mocking — der Request geht real raus und schlägt real fehl,
 * nur eben durch einen abgebrochenen Request statt einen toten Server.
 *
 * Erster Testfall zielt auf POST /risk/ampel (AmpelView.tsx übergibt
 * seiner ampelQuery ein onRetry). Der valuation-Fehlerpfad in
 * DepotView/AmpelView hatte ursprünglich KEIN onRetry an ErrorNotice
 * durchgereicht — mittlerweile gefixt (lib/usePaperDepot.ts:
 * refetchValuation, durchgereicht über DepotProvider/DepotView/
 * AmpelView), zweiter Testfall unten deckt genau das jetzt auch für
 * POST /paper/valuation ab.
 */
test.describe("Fehlerfall: Backend nicht erreichbar", () => {
  test("ErrorNotice mit Retry erscheint und erholt sich nach Retry (/risk/ampel)", async ({
    page,
  }) => {
    await page.route("**/risk/ampel", (route) => route.abort("failed"));

    await page.goto("/de/ampel?demo=1");

    // Next.js rendert selbst ein leeres role="alert"-Live-Region-Element
    // für Routenwechsel-Ankündigungen (#__next-route-announcer__) — ohne
    // den Text-Filter wäre die Rolle allein zweideutig.
    const errorBanner = page
      .getByRole("alert")
      .filter({ hasText: "Server nicht erreichbar" });
    await expect(errorBanner).toBeVisible({ timeout: 15_000 });
    await expect(errorBanner).toContainText(
      "Server nicht erreichbar. Läuft das Backend?",
    );
    const retryButton = errorBanner.getByRole("button", {
      name: "Erneut versuchen",
    });
    await expect(retryButton).toBeVisible();

    // Ampel-Karten dürfen währenddessen nicht erscheinen.
    await expect(
      page.getByRole("heading", { name: "Klumpenrisiko", exact: true }),
    ).not.toBeVisible();

    // Verbindung "reparieren" und erneut versuchen -> echter Inhalt.
    await page.unroute("**/risk/ampel");
    await retryButton.click();

    await expect(errorBanner).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Klumpenrisiko", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ErrorNotice mit Retry erscheint und erholt sich nach Retry (/paper/valuation)", async ({
    page,
  }) => {
    await page.route("**/paper/valuation", (route) => route.abort("failed"));

    await page.goto("/de/depot?demo=1");

    const errorBanner = page
      .getByRole("alert")
      .filter({ hasText: "Server nicht erreichbar" });
    await expect(errorBanner).toBeVisible({ timeout: 15_000 });
    const retryButton = errorBanner.getByRole("button", {
      name: "Erneut versuchen",
    });
    await expect(retryButton).toBeVisible();

    // Depot-Inhalt darf währenddessen nicht erscheinen.
    await expect(page.getByText("Größte: AAPL")).not.toBeVisible();

    await page.unroute("**/paper/valuation");
    await retryButton.click();

    await expect(errorBanner).not.toBeVisible();
    await expect(page.getByText("Größte: AAPL")).toBeVisible({
      timeout: 15_000,
    });
  });
});
