"""Shared request building blocks (API_CONTRACT.md §1.5).

REFERENCE PATTERN: PortfolioIn is the ONE way every endpoint accepts a
portfolio — weights in ANY positive scale (euros, shares, fractions);
renormalization happens inside the sentinel_core entry points that
consume it, never here. Period is a closed whitelist, not a free string.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

__all__ = ["Period", "PortfolioIn"]

Period = Literal["6mo", "1y", "2y", "5y"]


class PortfolioIn(BaseModel):
    """The only way to hand a portfolio to the API (API_CONTRACT §1.5)."""

    weights: dict[str, float]
