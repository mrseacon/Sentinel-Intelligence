"""risk/* routes (API_CONTRACT.md §2.4–§2.5).

Unlike paper/*, these endpoints necessarily compose SEVERAL core calls:
RiskMetricsOut/RiskAnalyzeOut have no core "collector" model (contract
§4: "core bietet Funktionen, die API komponiert"). Every value here
comes from a sentinel_core function; the only "decision" made in this
file is WHICH function to call for the concentration field, mirroring
the None-for-single-asset rule already used in
sentinel_core.risk.scoring.score_portfolio (kept in sync manually —
see the comment on _concentration_or_none).
"""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from sentinel_api.schemas.risk import (
    AmpelOut,
    BenchmarkCompareIn,
    BenchmarkCompareOut,
    BenchmarkOptionOut,
    BenchmarksOut,
    RiskAmpelIn,
    RiskAmpelOut,
    RiskAnalyzeIn,
    RiskAnalyzeOut,
    RiskMetricsOut,
    RiskProfileOut,
    RiskScoreOut,
    ScoreDriverOut,
)
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.education.ampel import (
    concentration_ampel,
    diversification_ampel,
    volatility_ampel,
)
from sentinel_core.education.explanations import benchmark_comparison_explanation
from sentinel_core.risk.benchmark import get_benchmark, list_benchmarks
from sentinel_core.risk.contribution import risk_contribution
from sentinel_core.risk.metrics import (
    daily_returns,
    diversification_ratio,
    herfindahl_index,
    max_drawdown,
    normalize_weights,
    portfolio_returns,
    portfolio_volatility,
)
from sentinel_core.risk.scoring import score_portfolio
from sentinel_core.risk.var import historical_cvar, historical_var

router = APIRouter(prefix="/risk", tags=["risk"])


@router.post("/analyze", response_model=RiskAnalyzeOut)
def post_risk_analyze(body: RiskAnalyzeIn) -> RiskAnalyzeOut:
    weights = body.portfolio.weights
    prices = load_multiple_assets(list(weights), period=body.period)
    returns = daily_returns(prices)
    return build_risk_analyze_out(weights, returns)


@router.post("/ampel", response_model=RiskAmpelOut)
def post_risk_ampel(body: RiskAmpelIn) -> RiskAmpelOut:
    weights = body.portfolio.weights
    prices = load_multiple_assets(list(weights), period=body.period)
    returns = daily_returns(prices)
    return build_risk_ampel_out(weights, returns)


@router.get("/benchmarks", response_model=BenchmarksOut)
def get_risk_benchmarks() -> BenchmarksOut:
    return BenchmarksOut(
        benchmarks=[
            BenchmarkOptionOut(id=b.id, title=b.title) for b in list_benchmarks()
        ]
    )


@router.post("/benchmark-compare", response_model=BenchmarkCompareOut)
def post_risk_benchmark_compare(body: BenchmarkCompareIn) -> BenchmarkCompareOut:
    benchmark = get_benchmark(body.benchmark_id)
    weights = body.portfolio.weights

    # Two independent trips through the SAME pipeline (no new math): the
    # portfolio's own tickers, and the benchmark as a trivial single-
    # ticker "portfolio" {ticker: 1.0}. Loaded separately (not aligned to
    # a common date range) — each side's own metrics are self-contained,
    # a joint covariance is not needed for this comparison.
    portfolio_prices = load_multiple_assets(list(weights), period=body.period)
    portfolio_returns_df = daily_returns(portfolio_prices)
    portfolio_profile = build_risk_profile_out(weights, portfolio_returns_df)

    benchmark_weights = {benchmark.ticker: 1.0}
    benchmark_prices = load_multiple_assets(list(benchmark_weights), period=body.period)
    benchmark_returns_df = daily_returns(benchmark_prices)
    benchmark_profile = build_risk_profile_out(benchmark_weights, benchmark_returns_df)

    comparison = benchmark_comparison_explanation(
        benchmark_title=benchmark.title,
        portfolio_volatility=portfolio_profile.metrics.volatility,
        benchmark_volatility=benchmark_profile.metrics.volatility,
        portfolio_score=portfolio_profile.score.score,
        benchmark_score=benchmark_profile.score.score,
    )

    return BenchmarkCompareOut(
        portfolio=portfolio_profile,
        benchmark_id=benchmark.id,
        benchmark_title=benchmark.title,
        benchmark=benchmark_profile,
        comparison=comparison,
    )


def build_risk_profile_out(
    weights: dict[str, float], returns: pd.DataFrame
) -> RiskProfileOut:
    """metrics + score only, no risk_contribution — shared by
    build_risk_analyze_out below (which adds contribution on top) and
    POST /risk/benchmark-compare (where contribution is meaningless: a
    single-ticker benchmark's contribution is trivially 100 % anyway)."""
    port_returns = portfolio_returns(weights, returns)

    metrics = RiskMetricsOut(
        volatility=portfolio_volatility(weights, returns),
        max_drawdown=max_drawdown(port_returns),
        var_95=historical_var(port_returns),
        cvar_95=historical_cvar(port_returns),
        hhi=_concentration_or_none(weights),
        diversification_ratio=diversification_ratio(weights, returns),
    )

    score = score_portfolio(weights, returns)

    return RiskProfileOut(
        metrics=metrics,
        score=RiskScoreOut(
            score=score.score,
            label=score.label,
            components=score.components,
            drivers=[
                ScoreDriverOut(factor=driver.name, contribution=driver.contribution)
                for driver in score.drivers
            ],
        ),
    )


def build_risk_analyze_out(
    weights: dict[str, float], returns: pd.DataFrame
) -> RiskAnalyzeOut:
    """Shared with POST /reports/risk-summary (sentinel_api/routers/
    reports.py): both endpoints need this exact composition over an
    already-loaded price frame, so the report avoids a second, redundant
    yfinance round trip for the same period/weights."""
    profile = build_risk_profile_out(weights, returns)
    contribution = risk_contribution(weights, returns)

    return RiskAnalyzeOut(
        metrics=profile.metrics,
        score=profile.score,
        risk_contribution={ticker: float(v) for ticker, v in contribution.items()},
    )


def build_risk_ampel_out(
    weights: dict[str, float], returns: pd.DataFrame
) -> RiskAmpelOut:
    """Shared with POST /reports/risk-summary, same reasoning as
    build_risk_analyze_out above."""
    # fixed order per contract §2.5: Klumpenrisiko, Diversifikation, Volatilität
    ampeln = [
        concentration_ampel(weights),
        diversification_ampel(weights, returns),
        volatility_ampel(weights, returns),
    ]
    return RiskAmpelOut(
        ampeln=[
            AmpelOut(
                id=ampel.name,
                title=ampel.title,
                status=ampel.status,
                value=ampel.value,
                explanation=ampel.explanation,
                lesson=ampel.lesson,
            )
            for ampel in ampeln
        ]
    )


def _concentration_or_none(weights: dict[str, float]) -> float | None:
    # Mirrors sentinel_core.risk.scoring.score_portfolio: HHI is
    # undefined for a single-asset portfolio (always 1.0), so the raw
    # metric and the score agree on returning None there.
    n_positions = int((normalize_weights(weights) > 0).sum())
    return herfindahl_index(weights) if n_positions >= 2 else None
