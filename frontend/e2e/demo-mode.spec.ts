import { expect, test } from "@playwright/test";

/**
 * Testfall (g): Demo-Modus Ein-/Ausstieg, Banner sichtbar, KEIN Einfluss
 * auf das echte Depot — automatisiert genau den Isolations-Test, der
 * zuletzt manuell durchgeklickt wurde (lib/DepotProvider.tsx: zwei
 * parallele usePaperDepot()-Instanzen, die Beispieldepot-Instanz ruft
 * nie readDepot()/writeDepot() auf).
 */
test.describe("Demo-Modus", () => {
  test("Ein-/Ausstieg zeigt Banner, echtes Depot bleibt leer", async ({
    page,
  }) => {
    await page.goto("/de/depot?demo=1");

    await expect(
      page.getByText("Beispieldaten – nicht dein echtes Depot."),
    ).toBeVisible();
    const exitButton = page.getByRole("button", { name: "Zu meinem Depot" });
    await expect(exitButton).toBeVisible();

    // Beispieldepot ist sofort befüllt (5 Positionen, lib/demo-depot.ts),
    // kein "Dein erster Trade"-Leerzustand.
    await expect(
      page.getByRole("heading", { name: "Dein erster Trade" }),
    ).not.toBeVisible();
    await expect(page.getByText("Größte: AAPL")).toBeVisible({
      timeout: 15_000,
    });

    // Echtes localStorage-Depot darf durch die Demo nicht angefasst
    // werden — der zentrale Anspruch aus der Aufgabenstellung.
    const realDepotDuringDemo = await page.evaluate(() =>
      window.localStorage.getItem("sentinel_paper_depot"),
    );
    expect(realDepotDuringDemo).toBeNull();

    await exitButton.click();

    // Zurück im echten (leeren) Depot: Banner weg, Leer-Zustand da.
    await expect(
      page.getByText("Beispieldaten – nicht dein echtes Depot."),
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dein erster Trade" }),
    ).toBeVisible();
  });

  test("ein echter Trade bleibt beim Demo-Einstieg und -Ausstieg unangetastet", async ({
    page,
  }) => {
    // Erst ein echter Trade im echten Depot (wie im Trade-Flow-Test).
    await page.goto("/de/depot");
    await page.getByRole("button", { name: "Apple auswählen" }).click();
    await page.getByRole("button", { name: "Preis anzeigen" }).click();
    await expect(page.getByText("Ordervolumen")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Trade bestätigen" }).click();
    await expect(
      page.getByText("Trade ausgeführt. Was bedeutet das für dein Risiko?"),
    ).toBeVisible();

    const realDepotBefore = await page.evaluate(() =>
      window.localStorage.getItem("sentinel_paper_depot"),
    );
    expect(realDepotBefore).not.toBeNull();
    const txCountBefore = JSON.parse(realDepotBefore!).transactions.length;
    expect(txCountBefore).toBe(1);

    // Jetzt in den Demo-Modus wechseln: zeigt das Beispieldepot (5
    // Positionen inkl. MSFT/NVDA/JNJ/KO), nicht das echte Ein-Positionen-
    // Depot von eben.
    await page.goto("/de/depot?demo=1");
    await expect(page.getByText("Größte: AAPL")).toBeVisible({
      timeout: 15_000,
    });
    // Beispieldepot hat immer genau 5 Positionen (lib/demo-depot.ts) —
    // die Donut-Center-Beschriftung fasst das als einen Text zusammen.
    await expect(page.getByText("5 Positionen")).toBeVisible();

    // localStorage unverändert während der Demo.
    const realDepotDuringDemo = await page.evaluate(() =>
      window.localStorage.getItem("sentinel_paper_depot"),
    );
    expect(JSON.parse(realDepotDuringDemo!).transactions.length).toBe(1);

    // Zurück zum echten Depot: exakt die eine Transaktion von vorhin,
    // keine Vermischung mit den Beispiel-Positionen.
    await page.getByRole("button", { name: "Zu meinem Depot" }).click();
    await expect(page.getByText("Größte: AAPL")).toBeVisible({
      timeout: 15_000,
    });
    const realDepotAfter = await page.evaluate(() =>
      window.localStorage.getItem("sentinel_paper_depot"),
    );
    expect(JSON.parse(realDepotAfter!).transactions.length).toBe(1);
  });
});
