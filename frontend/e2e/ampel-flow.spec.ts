import { expect, test } from "@playwright/test";

import { gotoWithDemoPortfolio } from "./helpers";

/**
 * Testfall (b): Ampel-Flow mit befülltem Depot (Beispieldepot statt
 * manuell traden) — alle drei Ampeln + Korrelationsmatrix erscheinen.
 * Testfall (f): PDF-Report-Download — Klick löst einen echten Request
 * aus, geprüft wird die Response (Status/Content-Type), nicht der
 * PDF-Inhalt (Aufgabenstellung: bewusst kein PDF-Parsing).
 */
test.describe("Ampel-Flow", () => {
  test("drei Ampeln und Korrelationsmatrix erscheinen für ein befülltes Depot", async ({
    page,
  }) => {
    await gotoWithDemoPortfolio(page, "/de/ampel");

    // Demo-Banner bestätigt: wir sehen das Beispieldepot, nicht ein
    // leeres echtes Depot (das würde stattdessen den Leer-Zustand-Hinweis
    // "Noch keine Positionen" zeigen statt der drei Ampel-Karten unten).
    await expect(
      page.getByText("Beispieldaten – nicht dein echtes Depot."),
    ).toBeVisible();

    // Die drei Ampeln sind Backend-Titel (education/ampel.py), auf
    // Deutsch stabil und unübersetzt durchgereicht.
    for (const title of ["Klumpenrisiko", "Diversifikation", "Volatilität"]) {
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible({ timeout: 15_000 });
    }

    // Jede Ampel zeigt einen Status (Grün/Gelb/Rot) — mindestens eine
    // muss sichtbar sein, damit wir wissen, dass echte Werte statt eines
    // Lade-/Fehlerzustands gerendert wurden.
    const anyStatus = page.getByText(/^(Grün|Gelb|Rot)$/);
    await expect(anyStatus.first()).toBeVisible();

    // Korrelationsmatrix: echte <table> mit stabilem aria-label
    // (CorrelationHeatmap.tsx) — funktioniert unabhängig von Farben.
    const correlationTable = page.getByRole("table", {
      name: "Korrelationsmatrix der Depot-Positionen",
    });
    await expect(correlationTable).toBeVisible({ timeout: 15_000 });
    // Das Beispieldepot enthält AAPL (lib/demo-depot.ts) — muss als
    // Spaltenkopf in der Matrix auftauchen.
    await expect(
      correlationTable.getByRole("columnheader", { name: "AAPL" }),
    ).toBeVisible();
  });

  test("PDF-Report-Download löst einen erfolgreichen Request aus", async ({
    page,
  }) => {
    await gotoWithDemoPortfolio(page, "/de/ampel");

    await expect(
      page.getByRole("heading", { name: "Klumpenrisiko", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    const downloadButton = page.getByRole("button", {
      name: "Als PDF-Report herunterladen",
    });
    await expect(downloadButton).toBeVisible();

    // Bewusst die Response prüfen statt den PDF-Inhalt zu parsen
    // (Aufgabenstellung Testfall f) — Status + Content-Type reichen, um
    // zu bestätigen, dass der echte Report-Endpunkt ein echtes PDF
    // ausliefert.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/reports/risk-summary") &&
          res.request().method() === "POST",
      ),
      downloadButton.click(),
    ]);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });
});
