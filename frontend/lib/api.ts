/**
 * EINZIGER Ort für Backend-Calls (ARCHITECTURE.md §3). Jede Komponente,
 * die Daten braucht, importiert eine Funktion von hier — nie `fetch()`
 * direkt. Fehler kommen immer als typisierter `ApiError` heraus, dessen
 * `code` die UI-Behandlung steuert (FRONTEND_DECISIONS.md §3).
 *
 * Nur Endpunkte, die sentinel_api tatsächlich implementiert (siehe
 * lib/types.ts). `/prices/*` fehlt noch serverseitig.
 */

import type {
  AccountValuationOut,
  OptimizeIn,
  OptimizeOut,
  PaperExecuteIn,
  PaperQuoteIn,
  PaperValuationIn,
  PortfolioIn,
  QuoteOut,
  RiskAmpelIn,
  RiskAmpelOut,
  RiskAnalyzeIn,
  RiskAnalyzeOut,
  StressPresetsOut,
  StressReplayIn,
  StressReplayOut,
  MonteCarloIn,
  MonteCarloOut,
  TransactionIO,
  ApiErrorBody,
} from "./types";

// Lokale FastAPI-Instanz in der Entwicklung; in Produktion via Env-Var
// gesetzt (Deploy-Checkliste ARCHITECTURE §8).
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Typisierter Fehler für jede nicht-2xx-Antwort. `code` steuert das
 * UI-Verhalten (Banner vs. inline, Retry ja/nein) — `detail` wird immer
 * unverändert angezeigt (§1.4, bereits deutsch & nutzerfertig). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers:
        init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json", ...init.headers }
          : init?.headers,
    });
  } catch {
    // Netzwerkfehler (Backend nicht erreichbar) — gleiche Behandlung
    // wie ein serverseitiges UPSTREAM_UNAVAILABLE (§3-Tabelle: Retry).
    throw new ApiError(503, {
      detail: "Server nicht erreichbar. Läuft das Backend?",
      code: "UPSTREAM_UNAVAILABLE",
    });
  }

  if (!response.ok) {
    const body: ApiErrorBody = await response.json().catch(() => ({
      detail: "Unbekannter Fehler.",
      code: "DOMAIN_ERROR",
    }));
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

// --- health -----------------------------------------------------------------

export function getHealth(): Promise<{ status: string }> {
  return request("/health");
}

// --- risk/* -------------------------------------------------------------------

export function postRiskAnalyze(body: RiskAnalyzeIn): Promise<RiskAnalyzeOut> {
  return postJson("/risk/analyze", body);
}

export function postRiskAmpel(body: RiskAmpelIn): Promise<RiskAmpelOut> {
  return postJson("/risk/ampel", body);
}

// --- portfolio/* --------------------------------------------------------------

export function postPortfolioOptimize(body: OptimizeIn): Promise<OptimizeOut> {
  return postJson("/portfolio/optimize", body);
}

export function postPortfolioUpload(file: File): Promise<PortfolioIn> {
  const formData = new FormData();
  formData.append("file", file);
  return request("/portfolio/upload", { method: "POST", body: formData });
}

// --- paper/* --------------------------------------------------------------------

export function postPaperQuote(body: PaperQuoteIn): Promise<QuoteOut> {
  return postJson("/paper/quote", body);
}

export function postPaperExecute(
  body: PaperExecuteIn,
): Promise<TransactionIO> {
  return postJson("/paper/execute", body);
}

export function postPaperValuation(
  body: PaperValuationIn,
): Promise<AccountValuationOut> {
  return postJson("/paper/valuation", body);
}

// --- stress/* --------------------------------------------------------------------

export function postStressReplay(
  body: StressReplayIn,
): Promise<StressReplayOut> {
  return postJson("/stress/replay", body);
}

export function getStressPresets(): Promise<StressPresetsOut> {
  return request("/stress/presets");
}

// --- simulation/* ------------------------------------------------------------------

export function postSimulationMonteCarlo(
  body: MonteCarloIn,
): Promise<MonteCarloOut> {
  return postJson("/simulation/monte-carlo", body);
}
