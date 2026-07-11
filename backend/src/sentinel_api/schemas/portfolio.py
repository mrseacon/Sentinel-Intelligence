"""portfolio/* schemas (API_CONTRACT.md §2.6, §2.12a).

OptimizeOut is the one API schema that ADDS a field beyond its core
model (OptimizationResult): the optimizer's result is a property of the
input TICKER SET, not a buy list, so principle 3 is riskiest here.
core has no text field for this; the disclaimer is deliberately added
at the API layer (contract §2.6/§3.4), not in sentinel_core.
"""

from __future__ import annotations

from pydantic import BaseModel

from sentinel_api.schemas.common import Period

__all__ = ["OPTIMIZE_DISCLAIMER", "OptimizeIn", "OptimizeOut"]

OPTIMIZE_DISCLAIMER = (
    "Rechnerische Max-Sharpe-Gewichtung der eingegebenen Titel auf Basis "
    "vergangener Kurse – keine Empfehlung, Vergangenheit ist keine "
    "Garantie für die Zukunft."
)


class OptimizeIn(BaseModel):
    tickers: list[str]
    period: Period = "1y"


class OptimizeOut(BaseModel):
    weights: dict[str, float]
    expected_return: float
    volatility: float
    sharpe: float
    disclaimer: str
