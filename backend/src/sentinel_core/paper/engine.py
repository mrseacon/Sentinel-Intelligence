"""Trade preview and execution (ARCHITECTURE.md §4.1, §6).

Stateless by design: callers pass the account and its transaction list;
the engine validates against derived state and returns a new Transaction
for the caller to append. Hard errors, no margin: buys beyond cash and
sells beyond holdings are rejected with user-facing German messages.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import PAPER_TRADE_FEE
from sentinel_core.data.loader import get_latest_prices
from sentinel_core.paper.ledger import (
    EPSILON,
    PaperAccount,
    Side,
    Transaction,
    cash_from_transactions,
    positions_from_transactions,
)


class Quote(BaseModel):
    """Trade preview: frozen price, flat fee and the resulting cash delta."""

    model_config = ConfigDict(frozen=True)

    ticker: str
    side: Side
    quantity: int
    price: float
    price_asof: datetime
    fees: float
    gross_value: float
    cash_delta: float


def quote(ticker: str, quantity: int, side: Side) -> Quote:
    """Preview a trade at the last available (delayed) price."""
    if quantity <= 0:
        raise ValueError(f"Menge muss größer als 0 sein (angefragt: {quantity}).")

    latest = get_latest_prices([ticker])[ticker]
    gross = quantity * latest.price
    if side == "BUY":
        cash_delta = -(gross + PAPER_TRADE_FEE)
    else:
        cash_delta = gross - PAPER_TRADE_FEE
    return Quote(
        ticker=ticker,
        side=side,
        quantity=quantity,
        price=latest.price,
        price_asof=latest.asof,
        fees=PAPER_TRADE_FEE,
        gross_value=gross,
        cash_delta=cash_delta,
    )


def execute(
    account: PaperAccount,
    transactions: list[Transaction],
    ticker: str,
    side: Side,
    quantity: int,
) -> Transaction:
    """Validate and execute a trade; returns the new Transaction.

    The caller owns the ledger and appends the result — the engine never
    stores state (Phase 1: the list lives in localStorage).
    """
    trade = quote(ticker, quantity, side)

    if side == "BUY":
        cash = cash_from_transactions(account.start_cash, transactions)
        cost = trade.gross_value + trade.fees
        if cost > cash + EPSILON:
            raise ValueError(
                f"Kauf von {quantity} Stück {ticker} nicht möglich: "
                f"Kosten {cost:.2f} € (inkl. {trade.fees:.2f} € Gebühr), "
                f"verfügbares Cash {cash:.2f} €."
            )
    else:
        positions = positions_from_transactions(transactions)
        held = positions[ticker].quantity if ticker in positions else 0
        if quantity > held:
            raise ValueError(
                f"Verkauf von {quantity} Stück {ticker} nicht möglich, "
                f"nur {held} im Depot."
            )

    return Transaction(
        account_id=account.id,
        ticker=ticker,
        side=side,
        quantity=quantity,
        price=trade.price,
        price_asof=trade.price_asof,
        fees=trade.fees,
        executed_at=datetime.now(UTC),
    )
