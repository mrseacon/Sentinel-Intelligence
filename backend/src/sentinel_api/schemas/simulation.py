"""simulation/* schemas (API_CONTRACT.md §2.11).

MonteCarloOut is a 1:1 re-export of the core result model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from sentinel_api.schemas.common import PortfolioIn
from sentinel_core.simulation.monte_carlo import MonteCarloResult as MonteCarloOut

__all__ = ["MonteCarloIn", "MonteCarloOut"]


class MonteCarloIn(BaseModel):
    portfolio: PortfolioIn
    horizon_years: Literal[1, 5, 10]
