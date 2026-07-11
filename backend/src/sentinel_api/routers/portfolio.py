"""portfolio/* routes (API_CONTRACT.md §2.6, §2.12a).

/optimize composes load -> transform -> optimize (three core calls, no
decisions); /upload is the single-call ideal.
"""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from sentinel_api.schemas.common import PortfolioIn
from sentinel_api.schemas.portfolio import (
    OPTIMIZE_DISCLAIMER,
    OptimizeIn,
    OptimizeOut,
)
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.portfolio.optimization import optimize_max_sharpe
from sentinel_core.portfolio.upload import parse_portfolio_csv
from sentinel_core.risk.metrics import daily_returns

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# Module-level singleton instead of a call in the default argument
# (ruff B008) — FastAPI's own documented pattern for File()/Depends().
_CSV_FILE = File(...)


@router.post("/optimize", response_model=OptimizeOut)
def post_optimize(body: OptimizeIn) -> OptimizeOut:
    prices = load_multiple_assets(body.tickers, period=body.period)
    returns = daily_returns(prices)
    result = optimize_max_sharpe(returns)
    return OptimizeOut(
        weights=result.weights,
        expected_return=result.expected_return,
        volatility=result.volatility,
        sharpe=result.sharpe,
        disclaimer=OPTIMIZE_DISCLAIMER,
    )


@router.post("/upload", response_model=PortfolioIn)
async def post_upload(file: UploadFile = _CSV_FILE) -> PortfolioIn:
    content = await file.read()
    return PortfolioIn(weights=parse_portfolio_csv(content))
