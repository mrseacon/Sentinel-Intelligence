"""portfolio/* schemas (API_CONTRACT.md §2.6, §2.12a).

OptimizeOut is the one API schema that ADDS a field beyond its core
model (OptimizationResult): the optimizer's result is a property of the
input TICKER SET, not a buy list, so principle 3 is riskiest here.
core has no text field for this; the disclaimer is deliberately added
at the API layer (contract §2.6/§3.4), not in sentinel_core.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from sentinel_api.limits import MAX_PORTFOLIO_TICKERS
from sentinel_api.schemas.common import Period
from sentinel_core.data.loader import validate_ticker

__all__ = ["OPTIMIZE_DISCLAIMER", "OptimizeIn", "OptimizeOut"]

OPTIMIZE_DISCLAIMER = (
    "Rechnerische Max-Sharpe-Gewichtung der eingegebenen Titel auf Basis "
    "vergangener Kurse – keine Empfehlung, Vergangenheit ist keine "
    "Garantie für die Zukunft."
)


class OptimizeIn(BaseModel):
    tickers: list[str] = Field(max_length=MAX_PORTFOLIO_TICKERS)
    period: Period = "1y"

    @field_validator("tickers")
    @classmethod
    def _normalize_and_validate(cls, tickers: list[str]) -> list[str]:
        # security audit F5: allowlist before any Yahoo URL is built
        return [validate_ticker(str(t).strip().upper()) for t in tickers]


class OptimizeOut(BaseModel):
    weights: dict[str, float]
    expected_return: float
    volatility: float
    sharpe: float
    disclaimer: str
