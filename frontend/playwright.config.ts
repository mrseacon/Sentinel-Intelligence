import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Suite gegen eine ECHTE laufende Instanz (Backend + Frontend),
 * bewusst kein Mocking — genau die Integration zwischen beiden ist das,
 * was bisher bei jeder Änderung manuell durchgeklickt wurde
 * (ARCHITECTURE.md §9 nennt seither nur einen einzelnen Kern-Loop-
 * Smoke-Test; diese Suite ersetzt/erweitert das).
 *
 * Getrennt von vitest.config.ts: vitest bleibt reine Logik-Unit-Tests
 * (kein Browser, kein Server), Playwright hier ist die Browser-/HTTP-
 * Ebene gegen zwei echte Prozesse. Zwei unterschiedliche Testarten,
 * zwei Konfigurationsdateien, zwei npm-Skripte (`test` vs. `test:e2e`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  timeout: 45_000,
  expect: {
    // yfinance-gestützte Quote-/Valuation-Calls sind spürbar langsamer
    // als eine reine UI-Assertion — Standard-5s wäre hier zu knapp und
    // würde eher Backend-Latenz als einen echten Bug melden.
    timeout: 10_000,
  },

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Zwei Projekte statt eines: dieselben Specs laufen einmal in Light-
  // und einmal in Dark-Mode. Funktioniert nur, weil Selektoren in den
  // Specs bewusst über Text/Rolle/ARIA gehen, nie über Farben (s. AGENTS/
  // Aufgabenstellung Punkt 4) — Redesigns der Palette können diese Suite
  // dadurch nicht brechen.
  projects: [
    {
      name: "chromium-light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "chromium-dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],

  // Startet Backend UND Frontend automatisch für den Testlauf (Vorgabe:
  // "kein reines Mocking"). reuseExistingServer lokal, damit ein bereits
  // laufender `next dev`/uvicorn beim Iterieren nicht platt gemacht wird;
  // in CI immer frisch (sauberer Zustand, keine versteckte Altlast).
  webServer: [
    {
      // Identischer Start-Befehl wie render.yaml (Produktions-Deploy) —
      // eine Quelle für "wie startet man den Backend-Prozess".
      command: "PYTHONPATH=src uvicorn sentinel_api.main:app --host 0.0.0.0 --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/docs",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Produktions-Build statt `next dev`: näher am echten Deploy-
      // Verhalten und vermeidet HMR-/Kompilier-Latenz als Flakiness-
      // Quelle im ersten Testlauf einer Seite.
      command: "npm run build && npm run start",
      url: "http://localhost:3000/de",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        // NEXT_PUBLIC_*-Variablen werden beim Build inlined — muss daher
        // schon für den `npm run build`-Teil dieses Kommandos gesetzt
        // sein, nicht erst beim Start.
        NEXT_PUBLIC_API_URL: "http://localhost:8000",
      },
    },
  ],
});
