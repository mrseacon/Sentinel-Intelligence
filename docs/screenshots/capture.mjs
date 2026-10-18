// Generates the README screenshots (English demo, 1280x800, light + dark).
// Needs backend (:8000) and frontend (:3000) running locally, see README.md.
// Uses the Playwright that is already a frontend devDependency.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../frontend/package.json"));
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const shots = [
  { name: "depot", path: "/en/depot", ready: (p) => p.getByText("Largest: AAPL").waitFor() },
  {
    name: "traffic-light",
    path: "/en/ampel",
    fullPage: true, // include the correlation heatmap below the fold
    ready: (p) => p.getByRole("table").first().waitFor(),
  },
  {
    name: "stress-test",
    path: "/en/stress",
    prepare: (p) => p.getByRole("button", { name: /financial crisis/i }).click(),
    ready: (p) => p.locator(".recharts-surface").first().waitFor(),
  },
  {
    name: "simulation",
    path: "/en/simulation",
    prepare: (p) => p.getByRole("button", { name: "5 years" }).click(),
    ready: (p) => p.getByText(/^×/).first().waitFor(),
  },
];

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: scheme,
  });
  for (const s of shots) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${s.path}?demo=1`);
    if (s.prepare) await s.prepare(page);
    await s.ready(page);
    await page.waitForTimeout(1200); // let chart animations finish
    await page.screenshot({
      path: path.join(here, `${s.name}-${scheme}.png`),
      fullPage: s.fullPage ?? false,
    });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
