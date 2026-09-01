import { expect, test } from "@playwright/test";

/**
 * Testfall (e): Analyze — manuelle Ticker-Eingabe, Analyse-Ergebnis
 * erscheint, Benchmark-Vergleich funktioniert. Bewusst KEIN Depot nötig
 * (FRONTEND_DECISIONS §4: analyze ist ein eigener, vom Paper-Depot
 * unabhängiger Portfolio-Slot) — einfach direkt auf /analyze.
 */
test.describe("Analyze", () => {
  test("manuelle Eingabe zeigt Analyse-Ergebnis und Benchmark-Vergleich", async ({
    page,
  }) => {
    await page.goto("/de/analyze");

    // Zwei beliebte Ticker über die Schnellauswahl statt Freitext —
    // robuster gegen das Ticker-Format-Regex (wie im Trade-Flow-Test).
    await page.getByRole("button", { name: "Apple hinzufügen" }).click();
    await page.getByRole("button", { name: "Microsoft hinzufügen" }).click();

    await page
      .getByRole("button", { name: "Portfolio analysieren" })
      .click();

    // Analyse-Ergebnis (POST /risk/analyze): Risiko-Score-Karte. Scoping
    // über den direkten Elternknoten der Section-Überschrift (AnalyzeView.tsx:
    // <section><h2>...</h2>...</section>) statt über `locator("section")
    // .filter({has})` — AnalyzePageChrome wickelt die ganze Seite selbst
    // in ein äußeres <section>, das den Filter sonst zweimal träfe.
    const analyzeSection = page
      .getByRole("heading", { name: "Analyse", exact: true })
      .locator("..");
    await expect(
      analyzeSection.getByRole("heading", { name: "Risiko-Score" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(analyzeSection.getByText("/ 100")).toBeVisible();

    // Benchmark-Vergleich (POST /risk/benchmark-compare): erste
    // verfügbare Vergleichsoption wählen, Ergebnis-Balken erscheinen.
    const benchmarkSection = page
      .getByRole("heading", { name: "Vergleich mit Index" })
      .locator("..");
    await expect(benchmarkSection).toBeVisible();

    const firstBenchmarkButton = benchmarkSection.getByRole("button").first();
    await expect(firstBenchmarkButton).toBeVisible({ timeout: 15_000 });
    await firstBenchmarkButton.click();

    // "Dein Portfolio" erscheint einmal pro verglichener Kennzahl
    // (Volatilität, Max Drawdown, Risiko-Score) — jedes Vorkommen belegt
    // gleichermaßen, dass der Vergleich gerendert wurde.
    await expect(
      benchmarkSection.getByText("Dein Portfolio").first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
