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

from fastapi import APIRouter

from sentinel_api.schemas.risk import (
    AmpelOut,
    RiskAmpelIn,
    RiskAmpelOut,
    RiskAnalyzeIn,
    RiskAnalyzeOut,
    RiskMetricsOut,
    RiskScoreOut,
    ScoreDriverOut,
)
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.education.ampel import (
    concentration_ampel,
    diversification_ampel,
    volatility_ampel,
)
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
    contribution = risk_contribution(weights, returns)

    return RiskAnalyzeOut(
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
        risk_contribution={ticker: float(v) for ticker, v in contribution.items()},
    )


@router.post("/ampel", response_model=RiskAmpelOut)
def post_risk_ampel(body: RiskAmpelIn) -> RiskAmpelOut:
    weights = body.portfolio.weights
    prices = load_multiple_assets(list(weights), period=body.period)
    returns = daily_returns(prices)

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
