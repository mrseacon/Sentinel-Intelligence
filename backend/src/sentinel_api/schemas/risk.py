"""risk/* schemas (API_CONTRACT.md §2.4–§2.5).

RiskMetricsOut/RiskScoreOut/RiskAnalyzeOut have no 1:1 core counterpart:
core offers individual metric functions, the API composes them into one
response (contract §4 — deliberate, documented aggregation). AmpelOut
and ScoreDriverOut rename core's "name" field to "id"/"factor" (§3).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from sentinel_api.schemas.common import Period, PortfolioIn

__all__ = [
    "AmpelOut",
    "RiskAmpelIn",
    "RiskAmpelOut",
    "RiskAnalyzeIn",
    "RiskAnalyzeOut",
    "RiskMetricsOut",
    "RiskScoreOut",
    "ScoreDriverOut",
]


class RiskAnalyzeIn(BaseModel):
    portfolio: PortfolioIn
    period: Period = "1y"


class RiskMetricsOut(BaseModel):
    volatility: float
    max_drawdown: float
    var_95: float
    cvar_95: float
    hhi: float | None
    diversification_ratio: float


class ScoreDriverOut(BaseModel):
    factor: str
    contribution: float


class RiskScoreOut(BaseModel):
    score: float
    label: str
    components: dict[str, float]
    drivers: list[ScoreDriverOut]


class RiskAnalyzeOut(BaseModel):
    metrics: RiskMetricsOut
    score: RiskScoreOut
    risk_contribution: dict[str, float]


class RiskAmpelIn(BaseModel):
    portfolio: PortfolioIn
    period: Period = "1y"


class AmpelOut(BaseModel):
    id: str
    title: str
    status: Literal["green", "yellow", "red"]
    value: float
    explanation: str
    lesson: str


class RiskAmpelOut(BaseModel):
    ampeln: list[AmpelOut]
