/**
 * id -> englisches Label für backend-gelieferte Enum-Titel
 * (I18N_DECISIONS.md §5-Abgrenzung): AmpelOut.title, ScenarioPresetOut.title
 * und BenchmarkOptionOut.title kommen zwar aus der API, sind aber stabile
 * Enum-Label zu einer bereits maschinenlesbaren `id` — keine Freitext-
 * Erklärung mit Zahlen. Deshalb hier übersetzt, OHNE auf die Phase-2-
 * Backend-Locale-Erweiterung (§2) zu warten. Deutsch braucht keinen
 * Lookup: das Backend-`title` wird dort unverändert angezeigt.
 *
 * IDs sind bewusst als literale Strings dupliziert (nicht aus
 * sentinel_core importiert — es gibt keine Cross-Language-Imports).
 * Quelle: education/ampel.py, constants.py STRESS_PRESETS/BENCHMARKS.
 */
import type { Locale } from "./config";

const AMPEL_TITLES_EN: Record<string, string> = {
  concentration: "Concentration risk",
  diversification: "Diversification",
  volatility: "Volatility",
};

const STRESS_PRESET_TITLES_EN: Record<string, string> = {
  gfc_2008: "Financial crisis 2008/09",
  covid_2020: "Covid crash 2020",
  rates_2022: "Rate-hike bear market 2022",
};

const BENCHMARK_TITLES_EN: Record<string, string> = {
  msci_world: "MSCI World (URTH)",
  sp500: "S&P 500 (SPY)",
};

/** Unbekannte/neue IDs fallen auf den unveränderten Backend-Titel zurück
 * (Deutsch bleibt sichtbar) statt eine leere Übersetzung zu zeigen — Grund
 * für den `backendTitle`-Fallback ist derselbe wie beim Fehlercode-Mapping
 * (§3): eine Lücke soll nie zu leerem/kaputtem UI führen. */
function localizedLabel(
  table: Record<string, string>,
  id: string,
  backendTitle: string,
  locale: Locale,
): string {
  if (locale === "de") return backendTitle;
  return table[id] ?? backendTitle;
}

export function ampelTitle(id: string, backendTitle: string, locale: Locale): string {
  return localizedLabel(AMPEL_TITLES_EN, id, backendTitle, locale);
}

export function stressPresetTitle(
  id: string,
  backendTitle: string,
  locale: Locale,
): string {
  return localizedLabel(STRESS_PRESET_TITLES_EN, id, backendTitle, locale);
}

export function benchmarkTitle(
  id: string,
  backendTitle: string,
  locale: Locale,
): string {
  return localizedLabel(BENCHMARK_TITLES_EN, id, backendTitle, locale);
}
