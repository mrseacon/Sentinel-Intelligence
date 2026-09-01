import { expect, test } from "@playwright/test";

/**
 * Kern-Loop-Test (a): Preisvorschau -> Trade bestätigen -> Position
 * erscheint. Jeder Playwright-Test bekommt einen frischen Browser-
 * Context (eigenes localStorage) — kein manuelles Zurücksetzen des
 * Paper-Depots nötig, jeder Testlauf startet wie ein neuer Besucher.
 *
 * Selektoren bewusst über Rolle+Text/ARIA (nie über Farbe/Klasse), s.
 * playwright.config.ts — dieselben Specs laufen in chromium-light UND
 * chromium-dark.
 */
test.describe("Trade-Flow", () => {
  test("Preisvorschau abrufen, Trade bestätigen, Position erscheint", async ({
    page,
  }) => {
    await page.goto("/de/depot");

    // Leer-Zustand: geführte Karte "Dein erster Trade" (FRONTEND_DECISIONS
    // §7 User-Story), Trade-Dialog direkt darunter vorausgefüllt.
    await expect(
      page.getByRole("heading", { name: "Dein erster Trade" }),
    ).toBeVisible();

    // Beliebter Ticker statt Freitext-Eingabe: robuster gegen das
    // Ticker-Format-Regex und näher am tatsächlichen Einsteiger-Pfad
    // (lib/popular-tickers.ts).
    await page
      .getByRole("button", { name: "Apple auswählen" })
      .click();

    await page.getByRole("button", { name: "Preis anzeigen" }).click();

    // Quote-Vorschau (POST /paper/quote) — Ordervolumen/Cash danach/
    // Gewicht danach/Gebühr erscheinen erst, wenn die echte Backend-
    // Antwort da ist.
    await expect(page.getByText("Ordervolumen")).toBeVisible();
    await expect(page.getByText("Gebühr")).toBeVisible();

    const confirmButton = page.getByRole("button", {
      name: "Trade bestätigen",
    });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // POST /paper/execute erfolgreich -> Erfolgs-Banner mit Link zur
    // Ampel (DepotView.tsx justTraded-State).
    await expect(
      page.getByText("Trade ausgeführt. Was bedeutet das für dein Risiko?"),
    ).toBeVisible();

    // Position ist jetzt aus der Transaktion abgeleitet (paper/valuation)
    // und erscheint in der Positionstabelle. "AAPL" allein wäre auf
    // dieser Seite mehrdeutig (Donut-Legende zeigt denselben Ticker),
    // daher der data-testid-Anker (DepotView.tsx) statt Text-Scoping.
    const positionsTable = page.getByTestId("positions-table");
    await expect(
      positionsTable.getByRole("heading", { name: "Deine Positionen" }),
    ).toBeVisible();
    await expect(positionsTable.getByText("AAPL")).toBeVisible();

    // Und in der Kennzahlen-Kachel "Positionen".
    await expect(page.getByText("Größte: AAPL")).toBeVisible();
  });
});
