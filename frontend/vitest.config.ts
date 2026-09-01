import { defaultExclude, defineConfig } from "vitest/config";

// Pure-logic unit tests only (no React rendering) — the i18n
// completeness check (lib/i18n/error-messages.test.ts) just compares
// string arrays, so no jsdom/React plugin is needed yet. Add those when
// the first component test is written.
//
// Getrennte Test-Ebene von e2e/ (Playwright, echter Browser + echte
// Server, s. playwright.config.ts): vitest's Default-Glob würde sonst
// auch e2e/*.spec.ts aufsammeln und mit vitest's eigenem test()/
// describe() kollidieren (Playwright importiert dieselben Namen aus
// @playwright/test) — deshalb hier explizit ausgeschlossen statt nur
// implizit "funktioniert zufällig".
export default defineConfig({
  test: {
    environment: "node",
    exclude: [...defaultExclude, "e2e/**"],
  },
});
