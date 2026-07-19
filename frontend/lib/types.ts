/**
 * TypeScript-Spiegel des API-Vertrags (API_CONTRACT.md). Manuell gepflegt
 * (FRONTEND_DECISIONS.md §5) — jeder Typ trägt einen §-Verweis auf seinen
 * Contract-Abschnitt. Wechsel-Trigger für Codegen: Phase-2-Schemaänderung
 * oder ein zweiter API-Konsument.
 *
 * Nur Endpunkte, die sentinel_api tatsächlich implementiert (11 Routen:
 * paper/*, risk/*, stress/*, simulation/*, portfolio/*). `/prices/*` ist
 * in API_CONTRACT §2.2/§2.3 spezifiziert, aber noch nicht gebaut — daher
 * hier bewusst ausgelassen, um keine Typen für nicht existierende Routen
 * zu pflegen.
 *
 * Zahlen-Konventionen (§1.2), gelten für ALLE Felder unten:
 * - Anteile/Renditen: Dezimalbruch (0.42 = 42 %), auch bei "_pct"-Suffix.
 * - VaR/CVaR/max_drawdown: negativ (Verlust = negativ, Return-Raum).
 * - Wertverläufe (Stress/Simulation): normierte Faktoren, Start = 1.0.
 * - Geldbeträge: float in Euro. Stückzahlen: int (keine Bruchstücke, v1).
 */

// --- §1.1 Fehlerformat --------------------------------------------------

/** Response-Body jeder Fehlerantwort — IMMER dieses Schema. */
export interface ApiErrorBody {
  detail: string; // deutsch, direkt anzeigbar (§1.4)
  code: string; // stabil, z.B. "TICKER_NOT_FOUND" — steuert nur UI-Verhalten
}

// --- §1.5 Gemeinsame Bausteine -------------------------------------------

export type Period = "6mo" | "1y" | "2y" | "5y";
export type Side = "BUY" | "SELL";

/** DER einzige Weg, ein Portfolio zu übergeben. Beliebige positive Skala
 * (€-Beträge/Stück/Anteile) — Renormalisierung passiert serverseitig. */
export interface PortfolioIn {
  weights: Record<string, number>;
}

/** 1:1 core ledger.PaperAccount. */
export interface PaperAccountIn {
  id: string;
  name: string;
  start_cash: number;
  created_at: string; // ISO 8601
}

/** 1:1 core ledger.Transaction — identisches Schema für Request UND
 * Response; der Client speichert exakt das, was er zurückbekommt. */
export interface TransactionIO {
  id: string;
  account_id: string | null;
  ticker: string;
  side: Side;
  quantity: number; // int, ganze Stück (v1 keine Bruchstücke)
  price: number;
  price_asof: string | null; // ISO 8601, oft ohne Zeitzone (Tageskurs)
  fees: number;
  executed_at: string; // ISO 8601, tz-aware (UTC)
}

// --- §2.4 POST /risk/analyze ----------------------------------------------

export interface RiskAnalyzeIn {
  portfolio: PortfolioIn;
  period?: Period; // default "1y"
}

export interface RiskMetricsOut {
  volatility: number; // annualisiert, Dezimalbruch
  max_drawdown: number; // negativ
  var_95: number; // negativ, täglich
  cvar_95: number; // negativ, täglich
  hhi: number | null; // null bei Single-Asset-Depot
  diversification_ratio: number;
}

export interface ScoreDriverOut {
  factor: string;
  contribution: number;
}

export interface RiskScoreOut {
  score: number; // 0..100
  label: "Low" | "Moderate" | "High" | "Severe";
  components: Record<string, number>; // Faktor -> normierter Wert 0..1
  drivers: ScoreDriverOut[]; // Top 3
}

export interface RiskAnalyzeOut {
  metrics: RiskMetricsOut;
  score: RiskScoreOut;
  risk_contribution: Record<string, number>; // Ticker -> Anteil, Summe 1
}

// --- §2.5 POST /risk/ampel -------------------------------------------------

export interface RiskAmpelIn {
  portfolio: PortfolioIn;
  period?: Period;
}

export type AmpelStatus = "green" | "yellow" | "red";

export interface AmpelOut {
  id: "concentration" | "diversification" | "volatility";
  title: string; // deutsch, z.B. "Klumpenrisiko"
  status: AmpelStatus;
  value: number;
  explanation: string; // depot-spezifisch, fertig formatiert
  lesson: string; // statische Lernkarte
}

export interface RiskAmpelOut {
  ampeln: AmpelOut[]; // immer genau 3, feste Reihenfolge
}

// --- §2.6 POST /portfolio/optimize -----------------------------------------

export interface OptimizeIn {
  tickers: string[]; // bewusst keine Gewichte — der Optimizer bestimmt sie
  period?: Period;
}

export interface OptimizeOut {
  weights: Record<string, number>;
  expected_return: number; // annualisiert, Dezimalbruch
  volatility: number;
  sharpe: number;
  disclaimer: string; // Pflichtfeld, Prinzip 3 — immer anzeigen
}

// --- §2.7 POST /paper/quote -------------------------------------------------

export interface PaperQuoteIn {
  ticker: string;
  side: Side;
  quantity: number; // > 0
}

export interface QuoteOut {
  ticker: string;
  side: Side;
  quantity: number;
  price: number;
  price_asof: string;
  fees: number;
  gross_value: number;
  cash_delta: number; // negativ bei BUY; "Cash danach" = cash + cash_delta
}

// --- §2.8 POST /paper/execute -----------------------------------------------

export interface PaperExecuteIn {
  account: PaperAccountIn;
  transactions: TransactionIO[]; // komplette Client-Historie (Phase 1)
  ticker: string;
  side: Side;
  quantity: number;
}
// Response: TransactionIO (nur die NEUE Transaktion)

// --- §2.9 POST /paper/valuation ----------------------------------------------

export interface PaperValuationIn {
  account: PaperAccountIn;
  transactions: TransactionIO[];
}

export interface PositionValueOut {
  ticker: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  price_asof: string;
  market_value: number;
  unrealized_pnl: number;
}

export interface AccountValuationOut {
  cash: number;
  market_value: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number; // Dezimalbruch trotz "_pct"-Suffix (§1.2)
  positions: PositionValueOut[];
}

// --- §2.10 POST /stress/replay, §2.12 GET /stress/presets --------------------

export interface StressReplayIn {
  portfolio: PortfolioIn;
  preset_id: string; // "gfc_2008" | "covid_2020" | "rates_2022"
}

export interface StressReplayOut {
  preset_id: string;
  title: string;
  start: string; // YYYY-MM-DD
  end: string;
  dates: string[]; // parallel zu value_path
  value_path: number[]; // Faktor, Start 1.0
  max_drawdown: number; // negativ
  total_return: number;
  volatility: number;
  coverage: number; // Dezimalbruch
  included_tickers: string[];
  excluded_tickers: string[];
  explanation: string;
  lesson: string;
  disclaimer: string;
}

export interface ScenarioPresetOut {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface StressPresetsOut {
  presets: ScenarioPresetOut[];
}

// --- §2.11 POST /simulation/monte-carlo --------------------------------------

export interface MonteCarloIn {
  portfolio: PortfolioIn;
  horizon_years: 1 | 5 | 10;
}

export interface MonteCarloOut {
  horizon_years: number;
  n_paths: number;
  seed: number;
  trading_days: number[]; // Offsets, Start 0 — parallel zu p10/p50/p90
  p10: number[]; // Faktoren, Start 1.0
  p50: number[];
  p90: number[];
  final_p10: number;
  final_p50: number;
  final_p90: number;
  history_days: number;
  history_years: number;
  limiting_ticker: string | null;
  recycling_factor: number;
  thin_history: boolean;
  explanation: string;
  lesson: string;
  disclaimer: string;
}

// --- §2.12a POST /portfolio/upload --------------------------------------------
// Request: multipart/form-data (Feld "file"). Response: PortfolioIn.
