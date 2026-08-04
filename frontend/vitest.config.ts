import { defineConfig } from "vitest/config";

// Pure-logic unit tests only (no React rendering) — the i18n
// completeness check (lib/i18n/error-messages.test.ts) just compares
// string arrays, so no jsdom/React plugin is needed yet. Add those when
// the first component test is written.
export default defineConfig({
  test: {
    environment: "node",
  },
});
