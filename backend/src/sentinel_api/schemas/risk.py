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
    "BenchmarkCompareIn",
    "BenchmarkCompareOut",
    "BenchmarkOptionOut",
    "BenchmarksOut",
    "RiskAmpelIn",
    "RiskAmpelOut",
    "RiskAnalyzeIn",
    "RiskAnalyzeOut",
    "RiskMetricsOut",
    "RiskProfileOut",
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


# --- risk/benchmark-compare ---------------------------------------------------


class RiskProfileOut(BaseModel):
    """metrics + score, no risk_contribution (§4-style aggregation, like
    RiskAnalyzeOut but trimmed — contribution is meaningless for a
    single-ticker benchmark and unused for the comparison itself). Shared
    shape for BOTH the portfolio and the benchmark side, so the frontend
    can render them with the same component."""

    metrics: RiskMetricsOut
    score: RiskScoreOut


class BenchmarkOptionOut(BaseModel):
    id: str
    title: str


class BenchmarksOut(BaseModel):
    benchmarks: list[BenchmarkOptionOut]


class BenchmarkCompareIn(BaseModel):
    portfolio: PortfolioIn
    benchmark_id: str
    period: Period = "1y"


class BenchmarkCompareOut(BaseModel):
    portfolio: RiskProfileOut
    benchmark_id: str
    benchmark_title: str
    benchmark: RiskProfileOut
    comparison: str  # titel-frei, beschreibend, keine Kaufempfehlung (Prinzip 3)
