import { expect, test, type Page } from "@playwright/test";

import { gotoWithDemoPortfolio } from "./helpers";

/**
 * Englische Oberfläche ohne deutsche Reste (I18N_DECISIONS.md §2): auch
 * die backend-generierten Erklärtexte, Lernkarten, Disclaimer, Preset-
 * Titel und der Benchmark-Vergleich kommen auf /en englisch.
 *
 * Deutsch-Erkennung: Umlaute/ß plus typische deutsche Wörter. Bewusst
 * KEINE Ausnahmeliste für Inhalte: alle Texte inkl. Krisen-Titel werden
 * übersetzt. Ausgenommen ist nur, was nie im sichtbaren Text landet
 * (aria-label "Zu Deutsch wechseln" des Sprachumschalters) und
 * Fremdinhalte (News-Headlines bleiben eingeklappt, werden hier also
 * nicht gerendert).
 */
const GERMAN_MARKERS =
  /[äöüÄÖÜß„“]|\b(?:und|der|die|das|nicht|dein|deines|deinem|wäre|hätte|Depot|Jahren|Zeitraum|Szenario|Klumpenrisiko|Erklärung|Gewicht)\b/;

async function expectNoGerman(page: Page) {
  const text = await page.locator("body").innerText();
  const match = GERMAN_MARKERS.exec(text);
  const context = match
    ? text.slice(Math.max(0, match.index - 60), match.index + 60)
    : "";
  expect(match?.[0], `German text on English page: "…${context}…"`).toBe(
    undefined,
  );
}

test.describe("English UI contains no German", () => {
  test("landing and demo portfolio", async ({ page }) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { name: "Understand, don't guess." }),
    ).toBeVisible();
    await expectNoGerman(page);

    await gotoWithDemoPortfolio(page, "/en/depot");
    await expect(page.getByTestId("positions-table")).toBeVisible({
      timeout: 20_000,
    });
    await expectNoGerman(page);
  });

  test("risk traffic light with explanations and lessons", async ({ page }) => {
    await gotoWithDemoPortfolio(page, "/en/ampel");
    await expect(
      page.getByRole("heading", { name: "Concentration risk" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Your portfolio /).first()).toBeVisible();

    // Lernkarten aufklappen, damit auch die lesson-Texte im DOM stehen.
    for (const toggle of await page
      .getByRole("button", { name: "What does this mean?" })
      .all()) {
      await toggle.click();
    }
    await expectNoGerman(page);
  });

  test("stress test with every preset", async ({ page }) => {
    await gotoWithDemoPortfolio(page, "/en/stress");
    for (const title of [
      "Financial crisis 2008/09",
      "Covid crash 2020",
      "Rate-hike bear market 2022",
    ]) {
      const preset = page.getByRole("button", { name: new RegExp(title) });
      await expect(preset).toBeVisible({ timeout: 20_000 });
      await preset.click();
      await expect(
        page.getByText(new RegExp(`In the scenario "${title}"`)),
      ).toBeVisible({ timeout: 20_000 });
      await expectNoGerman(page);
    }
  });

  test("simulation for each horizon", async ({ page }) => {
    await gotoWithDemoPortfolio(page, "/en/simulation");
    for (const horizon of ["1 year", "5 years", "10 years"]) {
      const button = page.getByRole("button", { name: horizon, exact: true });
      await expect(button).toBeVisible({ timeout: 20_000 });
      await button.click();
      await expect(
        page.getByText(/^In 8 out of 10 simulated paths/),
      ).toBeVisible({ timeout: 20_000 });
      await expectNoGerman(page);
    }
  });

  test("analyze with benchmark and optimizer", async ({ page }) => {
    await page.goto("/en/analyze");
    await page.getByRole("button", { name: "Add Apple" }).click();
    await page.getByRole("button", { name: "Add Microsoft" }).click();
    await page.getByRole("button", { name: "Analyze portfolio" }).click();

    const benchmarkSection = page
      .getByRole("heading", { name: "Compare with index" })
      .locator("..");
    const firstBenchmark = benchmarkSection.getByRole("button").first();
    await expect(firstBenchmark).toBeVisible({ timeout: 20_000 });
    await firstBenchmark.click();
    await expect(
      benchmarkSection.getByText(/^Your portfolio fluctuates/),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Optimize portfolio" }).click();
    await expect(page.getByText(/^Mathematical max-Sharpe weighting/)).toBeVisible(
      { timeout: 20_000 },
    );
    await expectNoGerman(page);
  });
});

test.describe("Language switch without reload", () => {
  test("DE to EN swaps backend explanations and keeps demo mode", async ({
    page,
  }) => {
    await gotoWithDemoPortfolio(page, "/de/ampel");
    await expect(
      page.getByRole("heading", { name: "Klumpenrisiko" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Dein Depot /).first()).toBeVisible();

    // Marker im window-Objekt: überlebt nur eine Client-Navigation, ein
    // voller Reload würde ihn löschen.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    const ampelRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/risk/ampel") &&
        request.postDataJSON()?.lang === "en",
    );
    await page.getByRole("link", { name: "Switch to English" }).click();
    await ampelRequest;

    await expect(page).toHaveURL(/\/en\/ampel\?demo=1$/);
    await expect(
      page.getByRole("heading", { name: "Concentration risk" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Your portfolio /).first()).toBeVisible();
    await expect(page.getByText("Sample data, not your real portfolio.")).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __noReload?: boolean }).__noReload,
      ),
    ).toBe(true);
    await expectNoGerman(page);
  });
});
