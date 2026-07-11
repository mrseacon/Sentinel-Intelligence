"""simulation/* routes (API_CONTRACT.md §2.11).

Single-call ideal: simulate() already returns exactly the contract shape.
"""

from __future__ import annotations

from fastapi import APIRouter

from sentinel_api.schemas.simulation import MonteCarloIn, MonteCarloOut
from sentinel_core.simulation.monte_carlo import simulate

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/monte-carlo", response_model=MonteCarloOut)
def post_monte_carlo(body: MonteCarloIn) -> MonteCarloOut:
    return simulate(body.portfolio.weights, body.horizon_years)
