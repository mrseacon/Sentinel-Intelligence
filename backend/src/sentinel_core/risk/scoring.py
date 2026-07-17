"""Explainable heuristic risk score (KNOWLEDGE_EXTRACTION.md §5).

Deliberately heuristic and explainable — an explicit design decision
against black-box scoring. Every factor is normalized against a documented
anchor from constants.py and clamped to [0, 1]; the score is the weighted
sum times 100. Anchors and weights are domain decisions: never change
them silently (CLAUDE.md).

Concentration is optional: None for single-asset portfolios (HHI would
always be 1.0 there). A missing factor contributes 0 without rescaling
the other weights, so a single-asset portfolio can reach at most 95.
"""

from __future__ import annotations

import pandas as pd
from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import (
    SCORE_ANCHOR_CVAR_95,
    SCORE_ANCHOR_MAX_DRAWDOWN,
    SCORE_ANCHOR_VAR_95,
    SCORE_ANCHOR_VOLATILITY,
    SCORE_HHI_FLOOR,
    SCORE_HHI_RANGE,
    SCORE_LABEL_HIGH_MAX,
    SCORE_LABEL_LOW_MAX,
    SCORE_LABEL_MODERATE_MAX,
    SCORE_WEIGHT_CONCENTRATION,
    SCORE_WEIGHT_CVAR,
    SCORE_WEIGHT_MAX_DRAWDOWN,
    SCORE_WEIGHT_VAR,
    SCORE_WEIGHT_VOLATILITY,
)
from sentinel_core.errors import SentinelError
from sentinel_core.risk.metrics import (
    herfindahl_index,
    max_drawdown,
    normalize_weights,
    portfolio_returns,
    portfolio_volatility,
)
from sentinel_core.risk.var import historical_cvar, historical_var


class ScoreDriver(BaseModel):
    """One factor's weighted contribution to the score (explainability)."""

    model_config = ConfigDict(frozen=True)

    name: str
    contribution: float


class RiskScore(BaseModel):
    """Immutable score result (legacy: frozen dataclass)."""

    model_config = ConfigDict(frozen=True)

    score: float
    label: str
    # normalized factor values in [0, 1], keyed by factor name
    components: dict[str, float]
    # top 3 weighted contributions, zero contributions filtered out
    drivers: list[ScoreDriver]


def score_label(score: float) -> str:
    if score <= SCORE_LABEL_LOW_MAX:
        return "Low"
    if score <= SCORE_LABEL_MODERATE_MAX:
        return "Moderate"
    if score <= SCORE_LABEL_HIGH_MAX:
        return "High"
    return "Severe"


def risk_score(
    volatility: float,
    max_dd: float,
    var_95: float,
    cvar_95: float,
    hhi: float | None,
) -> RiskScore:
    """Compose the score from precomputed metrics.

    max_dd, var_95 and cvar_95 arrive in the negative return-space
    convention and are folded with abs(); volatility must be >= 0.
    """
    if volatility < 0:
        raise SentinelError(f"Volatilität darf nicht negativ sein ({volatility}).")

    components = {
        "volatility": _clamp01(volatility / SCORE_ANCHOR_VOLATILITY),
        "max_drawdown": _clamp01(abs(max_dd) / SCORE_ANCHOR_MAX_DRAWDOWN),
        "var_95": _clamp01(abs(var_95) / SCORE_ANCHOR_VAR_95),
        "cvar_95": _clamp01(abs(cvar_95) / SCORE_ANCHOR_CVAR_95),
    }
    if hhi is not None:
        components["concentration"] = _clamp01(
            (hhi - SCORE_HHI_FLOOR) / SCORE_HHI_RANGE
        )

    factor_weights = {
        "volatility": SCORE_WEIGHT_VOLATILITY,
        "max_drawdown": SCORE_WEIGHT_MAX_DRAWDOWN,
        "var_95": SCORE_WEIGHT_VAR,
        "cvar_95": SCORE_WEIGHT_CVAR,
        "concentration": SCORE_WEIGHT_CONCENTRATION,
    }
    contributions = {
        name: factor_weights[name] * value for name, value in components.items()
    }
    score = 100 * sum(contributions.values())

    drivers = [
        ScoreDriver(name=name, contribution=contribution)
        for name, contribution in sorted(
            contributions.items(), key=lambda item: item[1], reverse=True
        )
        if contribution > 0
    ][:3]

    return RiskScore(
        score=score,
        label=score_label(score),
        components=components,
        drivers=drivers,
    )


def score_portfolio(weights: dict[str, float], returns: pd.DataFrame) -> RiskScore:
    """Convenience wrapper: derive all factors from weights + returns."""
    port_returns = portfolio_returns(weights, returns)
    n_positions = int((normalize_weights(weights) > 0).sum())
    hhi = herfindahl_index(weights) if n_positions >= 2 else None
    return risk_score(
        volatility=portfolio_volatility(weights, returns),
        max_dd=max_drawdown(port_returns),
        var_95=historical_var(port_returns),
        cvar_95=historical_cvar(port_returns),
        hhi=hhi,
    )


def _clamp01(value: float) -> float:
    return min(max(value, 0.0), 1.0)
