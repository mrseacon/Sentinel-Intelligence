"""portfolio/* routes (API_CONTRACT.md §2.6, §2.12a).

/optimize composes load -> transform -> optimize (three core calls, no
decisions). /upload adds transport plumbing around one core call:
streaming size cap and .csv check (security audit F2) are API-layer
concerns, the CSV semantics stay in sentinel_core.
"""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from fastapi.concurrency import run_in_threadpool

from sentinel_api.limits import MAX_CSV_BYTES, MAX_PORTFOLIO_TICKERS
from sentinel_api.schemas.common import PortfolioIn
from sentinel_api.schemas.portfolio import (
    OPTIMIZE_DISCLAIMER,
    OptimizeIn,
    OptimizeOut,
)
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.errors import SentinelError
from sentinel_core.portfolio.optimization import optimize_max_sharpe
from sentinel_core.portfolio.upload import parse_portfolio_csv
from sentinel_core.risk.metrics import daily_returns

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# Module-level singleton instead of a call in the default argument
# (ruff B008) — FastAPI's own documented pattern for File()/Depends().
_CSV_FILE = File(...)

_READ_CHUNK_BYTES = 64 * 1024


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
    if not (file.filename or "").lower().endswith(".csv"):
        raise SentinelError(
            "Nur CSV-Dateien werden unterstützt ('.csv'-Endung erforderlich)."
        )

    # Read streaming and abort at the cap (F2) — never buffer an
    # arbitrarily large body just to reject it afterwards.
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_READ_CHUNK_BYTES):
        total += len(chunk)
        if total > MAX_CSV_BYTES:
            raise SentinelError(
                f"Die CSV-Datei ist zu groß (maximal "
                f"{MAX_CSV_BYTES // 1_000_000} MB)."
            )
        chunks.append(chunk)

    # pandas parsing is CPU-bound: run it in the threadpool so a large
    # file cannot stall the event loop for every other request (F2).
    weights = await run_in_threadpool(
        parse_portfolio_csv, b"".join(chunks), MAX_PORTFOLIO_TICKERS
    )
    return PortfolioIn(weights=weights)
