"""Risk traffic lights (ARCHITECTURE.md §5).

A presentation layer over the existing risk metrics — no new math. Each
Ampel returns status, value, a depot-specific explanation with concrete
numbers, and a static concept lesson. Thresholds live exclusively in
constants.py (v1, uncalibrated — ARCHITECTURE §10).
"""

from __future__ import annotations

import pandas as pd
from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import (
    AMPEL_DR_GREEN_MIN,
    AMPEL_DR_YELLOW_MIN,
    AMPEL_HHI_GREEN_MAX,
    AMPEL_HHI_YELLOW_MAX,
    AMPEL_MIN_POSITIONS_GREEN,
    AMPEL_VOL_GREEN_MAX,
    AMPEL_VOL_YELLOW_MAX,
)
from sentinel_core.education.explanations import (
    AmpelStatus,
    ampel_lesson,
    ampel_title,
    concentration_explanation,
    diversification_explanation,
    volatility_explanation,
)
from sentinel_core.i18n import DEFAULT_LANG, Lang
from sentinel_core.risk.metrics import (
    diversification_ratio,
    herfindahl_index,
    normalize_weights,
    portfolio_volatility,
)


class Ampel(BaseModel):
    """One traffic light: machine-readable id plus localized user-facing texts."""

    model_config = ConfigDict(frozen=True)

    name: str
    title: str
    status: AmpelStatus
    value: float
    explanation: str
    lesson: str


def concentration_status(hhi: float) -> AmpelStatus:
    if hhi <= AMPEL_HHI_GREEN_MAX:
        return "green"
    if hhi <= AMPEL_HHI_YELLOW_MAX:
        return "yellow"
    return "red"


def diversification_status(ratio: float, n_positions: int) -> AmpelStatus:
    if ratio >= AMPEL_DR_GREEN_MIN and n_positions >= AMPEL_MIN_POSITIONS_GREEN:
        return "green"
    if ratio >= AMPEL_DR_YELLOW_MIN:
        return "yellow"
    return "red"


def volatility_status(annualized_vol: float) -> AmpelStatus:
    if annualized_vol <= AMPEL_VOL_GREEN_MAX:
        return "green"
    if annualized_vol <= AMPEL_VOL_YELLOW_MAX:
        return "yellow"
    return "red"


def concentration_ampel(weights: dict[str, float], lang: Lang = DEFAULT_LANG) -> Ampel:
    normalized = normalize_weights(weights)
    hhi = herfindahl_index(weights)
    status = concentration_status(hhi)
    return Ampel(
        name="concentration",
        title=ampel_title("concentration", lang),
        status=status,
        value=hhi,
        explanation=concentration_explanation(status, hhi, normalized, lang),
        lesson=ampel_lesson("concentration", lang),
    )


def diversification_ampel(
    weights: dict[str, float], returns: pd.DataFrame, lang: Lang = DEFAULT_LANG
) -> Ampel:
    normalized = normalize_weights(weights)
    n_positions = int((normalized > 0).sum())
    ratio = diversification_ratio(weights, returns)
    status = diversification_status(ratio, n_positions)
    return Ampel(
        name="diversification",
        title=ampel_title("diversification", lang),
        status=status,
        value=ratio,
        explanation=diversification_explanation(status, ratio, n_positions, lang),
        lesson=ampel_lesson("diversification", lang),
    )


def volatility_ampel(
    weights: dict[str, float], returns: pd.DataFrame, lang: Lang = DEFAULT_LANG
) -> Ampel:
    annualized_vol = portfolio_volatility(weights, returns)
    status = volatility_status(annualized_vol)
    return Ampel(
        name="volatility",
        title=ampel_title("volatility", lang),
        status=status,
        value=annualized_vol,
        explanation=volatility_explanation(status, annualized_vol, lang),
        lesson=ampel_lesson("volatility", lang),
    )
