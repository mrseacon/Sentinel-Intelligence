"""Transaction ledger: event-sourcing light (ARCHITECTURE.md §4.1).

Positions and cash are ALWAYS derived from the transaction history, never
stored as state. Replay is deterministic: transactions are ordered by
(executed_at, id), so equal timestamps cannot flip the average-cost math
depending on input order.

Validation errors are ValueError with German, user-facing messages — they
travel through the API as error details shown in the UI.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from sentinel_core.constants import PAPER_START_CASH
from sentinel_core.errors import SentinelError

Side = Literal["BUY", "SELL"]

# Tolerance for float comparisons on cash amounts. Guards against artifacts
# like 0.30000000000000004 blocking a legitimate all-in buy; not a domain
# constant. Quantities are whole ints and compare exactly.
EPSILON = 1e-9


class Transaction(BaseModel):
    """One executed trade. Immutable — the ledger is append-only."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=lambda: str(uuid4()))
    # Phase-2 preparation: models already carry account_id (ARCHITECTURE §7).
    account_id: str | None = None
    ticker: str
    side: Side
    # Whole shares only in v1: beginners should understand quantity and
    # capital separately; fractional shares are deliberately out of scope.
    quantity: int = Field(gt=0)
    # Price is frozen at execution time; price_asof is the quote timestamp
    # so the UI can show "Kurs von HH:MM" (delayed data, ARCHITECTURE §1).
    price: float = Field(gt=0)
    price_asof: datetime | None = None
    fees: float = Field(ge=0)
    # Must be timezone-aware: replay sorts by executed_at, and comparing
    # naive with aware datetimes raises TypeError. AwareDatetime rejects
    # naive client payloads cleanly at validation time instead.
    executed_at: AwareDatetime


class PaperAccount(BaseModel):
    """Paper account. Cash is derived from start_cash + transactions."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = "Paper-Depot"
    start_cash: float = Field(default=PAPER_START_CASH, gt=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Position(BaseModel):
    """Derived holding — never persisted (ARCHITECTURE §4.1)."""

    ticker: str
    quantity: int
    avg_buy_price: float


def sorted_transactions(transactions: list[Transaction]) -> list[Transaction]:
    """Deterministic replay order: executed_at, then id as tie-breaker.

    The tie-breaker makes replay independent of the input list order —
    localStorage round-trips or API payloads must not change the result.
    """
    return sorted(transactions, key=lambda tx: (tx.executed_at, tx.id))


def positions_from_transactions(
    transactions: list[Transaction],
) -> dict[str, Position]:
    """Replay the ledger into current positions.

    avg_buy_price is the weighted average of buys (average cost method);
    sells reduce quantity only. A fully closed position is removed — a
    later re-buy starts a fresh average. Fees never enter avg_buy_price,
    they only affect cash.
    """
    quantities: dict[str, int] = {}
    avg_prices: dict[str, float] = {}

    for tx in sorted_transactions(transactions):
        held = quantities.get(tx.ticker, 0)
        if tx.side == "BUY":
            new_qty = held + tx.quantity
            avg_prices[tx.ticker] = (
                held * avg_prices.get(tx.ticker, 0.0) + tx.quantity * tx.price
            ) / new_qty
            quantities[tx.ticker] = new_qty
        else:
            if tx.quantity > held:
                raise SentinelError(
                    f"Verkauf von {tx.quantity} Stück {tx.ticker} nicht "
                    f"möglich, nur {held} im Depot."
                )
            remaining = held - tx.quantity
            if remaining == 0:
                quantities.pop(tx.ticker, None)
                avg_prices.pop(tx.ticker, None)
            else:
                quantities[tx.ticker] = remaining

    return {
        ticker: Position(ticker=ticker, quantity=qty, avg_buy_price=avg_prices[ticker])
        for ticker, qty in quantities.items()
    }


def cash_from_transactions(start_cash: float, transactions: list[Transaction]) -> float:
    """Replay the ledger into the current cash balance.

    Buys cost quantity * price + fees; sells credit quantity * price - fees.
    Negative cash means a corrupt history (the engine rejects such trades
    up front) and is a hard error — no margin (ARCHITECTURE §4.1).
    """
    cash = start_cash
    for tx in sorted_transactions(transactions):
        if tx.side == "BUY":
            cash -= tx.quantity * tx.price + tx.fees
        else:
            cash += tx.quantity * tx.price - tx.fees
        if cash < -EPSILON:
            raise SentinelError(
                f"Inkonsistente Transaktionshistorie: Cash wird durch "
                f"{tx.side} {tx.quantity} {tx.ticker} negativ "
                f"({cash:.2f} €)."
            )
    return cash
