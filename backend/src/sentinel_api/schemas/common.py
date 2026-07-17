"""Shared request building blocks (API_CONTRACT.md §1.5).

REFERENCE PATTERN: PortfolioIn is the ONE way every endpoint accepts a
portfolio — weights in ANY positive scale (euros, shares, fractions);
renormalization happens inside the sentinel_core entry points that
consume it, never here. Period is a closed whitelist, not a free string.

Security audit F1/F5: the ticker count is capped and every ticker key is
normalized (upper/strip) and validated against the outbound allowlist —
malformed symbols must never reach a Yahoo URL.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from sentinel_api.limits import MAX_PORTFOLIO_TICKERS
from sentinel_core.data.loader import validate_ticker

__all__ = ["Period", "PortfolioIn"]

Period = Literal["6mo", "1y", "2y", "5y"]


class PortfolioIn(BaseModel):
    """The only way to hand a portfolio to the API (API_CONTRACT §1.5)."""

    weights: dict[str, float] = Field(max_length=MAX_PORTFOLIO_TICKERS)

    @field_validator("weights")
    @classmethod
    def _normalize_and_validate_tickers(
        cls, weights: dict[str, float]
    ) -> dict[str, float]:
        # Keys colliding after normalization ("aapl" + "AAPL") are summed,
        # matching the CSV upload's documented duplicate semantics (§10).
        normalized: dict[str, float] = {}
        for raw_ticker, weight in weights.items():
            ticker = validate_ticker(str(raw_ticker).strip().upper())
            normalized[ticker] = normalized.get(ticker, 0.0) + weight
        return normalized
