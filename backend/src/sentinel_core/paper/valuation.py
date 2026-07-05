"""Account valuation: derived positions priced at the latest quotes.

Total P&L is (cash + market value) - start_cash. With event sourcing this
is automatically consistent: fees and realized gains are already reflected
in cash, unrealized gains in the market value.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from sentinel_core.data.loader import get_latest_prices
from sentinel_core.paper.ledger import (
    PaperAccount,
    Transaction,
    cash_from_transactions,
    positions_from_transactions,
)


class PositionValue(BaseModel):
    """One open position at current (delayed) prices."""

    model_config = ConfigDict(frozen=True)

    ticker: str
    quantity: int
    avg_buy_price: float
    current_price: float
    price_asof: datetime
    market_value: float
    unrealized_pnl: float


class AccountValuation(BaseModel):
    """Snapshot of the whole account, fully derived from the ledger."""

    model_config = ConfigDict(frozen=True)

    cash: float
    market_value: float
    total_value: float
    total_pnl: float
    total_pnl_pct: float
    positions: list[PositionValue]


def value_account(
    account: PaperAccount, transactions: list[Transaction]
) -> AccountValuation:
    """Value the account at the latest available prices.

    Prices are fetched in one batched call; a cash-only account performs
    no price lookup at all (graceful degradation: valuation of an empty
    depot works without internet).
    """
    positions = positions_from_transactions(transactions)
    cash = cash_from_transactions(account.start_cash, transactions)

    position_values: list[PositionValue] = []
    if positions:
        latest = get_latest_prices(sorted(positions))
        for ticker in sorted(positions):
            pos = positions[ticker]
            price = latest[ticker].price
            position_values.append(
                PositionValue(
                    ticker=ticker,
                    quantity=pos.quantity,
                    avg_buy_price=pos.avg_buy_price,
                    current_price=price,
                    price_asof=latest[ticker].asof,
                    market_value=pos.quantity * price,
                    unrealized_pnl=pos.quantity * (price - pos.avg_buy_price),
                )
            )

    market_value = sum(pv.market_value for pv in position_values)
    total_value = cash + market_value
    total_pnl = total_value - account.start_cash
    return AccountValuation(
        cash=cash,
        market_value=market_value,
        total_value=total_value,
        total_pnl=total_pnl,
        total_pnl_pct=total_pnl / account.start_cash,
        positions=position_values,
    )
