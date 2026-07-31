"""reports/* routes — PDF risk-summary export.

Presentation-only composition: reuses the SAME core functions risk/*
already calls (via build_risk_analyze_out/build_risk_ampel_out in
routers/risk.py) plus sentinel_core.stress.replay — no new domain logic
(ARCHITECTURE §1: core stays HTTP-/UI-free, PDF rendering lives entirely
in sentinel_api/reports/). Prices are loaded ONCE for analyze+ampel
(both use the same fixed 1-year window) instead of calling the two HTTP
handlers separately, avoiding a redundant yfinance round trip.

Error handling: everything BEFORE PDF generation (loading prices,
computing metrics) raises the same SentinelError -> {detail, code} path
as every other endpoint (register_error_handlers in main.py). Stress-
Replay is best-effort and explicitly NOT part of that contract: if the
default preset doesn't reach minimum coverage for this portfolio (or
any other SentinelError), the section is silently omitted rather than
failing the whole report (graceful degradation, ARCHITECTURE principle
2) — analyze/ampel are the report's essential content, stress is a
bonus. A failure INSIDE PDF rendering itself (reportlab) is deliberately
NOT caught here: it would be a bug (bad layout data), not a user-facing
domain error, so it falls through to the generic 500 INTERNAL_ERROR
handler like any other unexpected exception (API_CONTRACT §1.1).

Size/rate: PortfolioIn already caps at MAX_PORTFOLIO_TICKERS (50, same
schema as every other endpoint); this endpoint does two SEQUENTIAL
yfinance-loading phases instead of one (analyze+ampel share a load,
stress needs a separate preset-windowed one), each still bounded by the
loader's per-request timeout (_REQUEST_TIMEOUT_SECONDS). No dedicated
rate limiting is added here — F9 (rate limiting) is deliberately
deferred project-wide (see deploy prep commit), and this endpoint is
bounded by the same primitives as everything else, just twice. Revisit
if this specific endpoint sees abuse.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Response

from sentinel_api.reports.pdf import build_risk_summary_pdf
from sentinel_api.routers.risk import build_risk_ampel_out, build_risk_analyze_out
from sentinel_api.schemas.reports import ReportRiskSummaryIn
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.errors import SentinelError
from sentinel_core.risk.metrics import daily_returns
from sentinel_core.stress.replay import DEFAULT_CACHE_DIR
from sentinel_core.stress.replay import replay as stress_replay

router = APIRouter(prefix="/reports", tags=["reports"])

# covid_2020 has the shortest window of the three presets (fastest to
# compute/cache) and is still a well-known, recognizable example for a
# general-purpose report.
_DEFAULT_STRESS_PRESET = "covid_2020"
_REPORT_PERIOD = "1y"

# Same override mechanism as routers/stress.py (F5, ARCHITECTURE §8
# deploy checklist) — duplicated here rather than imported since these
# are two independent entry points into the same core function.
_STRESS_CACHE_DIR = (
    Path(os.environ["STRESS_CACHE_DIR"])
    if os.environ.get("STRESS_CACHE_DIR")
    else DEFAULT_CACHE_DIR
)


@router.post("/risk-summary")
def post_report_risk_summary(body: ReportRiskSummaryIn) -> Response:
    weights = body.portfolio.weights

    prices = load_multiple_assets(list(weights), period=_REPORT_PERIOD)
    returns = daily_returns(prices)
    analysis = build_risk_analyze_out(weights, returns)
    ampel_out = build_risk_ampel_out(weights, returns)

    stress = _try_stress_replay(weights)

    pdf_bytes = build_risk_summary_pdf(
        weights=weights,
        analysis=analysis,
        ampeln=ampel_out.ampeln,
        stress=stress,
        generated_at=datetime.now(UTC),
    )

    filename = f"sentinel-risiko-report-{datetime.now(UTC).date().isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _try_stress_replay(weights: dict[str, float]):
    try:
        return stress_replay(
            weights, _DEFAULT_STRESS_PRESET, cache_dir=_STRESS_CACHE_DIR
        )
    except SentinelError:
        # e.g. STRESS_INSUFFICIENT_COVERAGE for a young-heavy portfolio —
        # optional section, degrade gracefully instead of failing the
        # whole report (see module docstring).
        return None
