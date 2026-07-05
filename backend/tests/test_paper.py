"""Mandatory paper engine tests per ARCHITECTURE.md §9: sell > holdings,
buy > cash, position derivation incl. partial sells and avg_buy_price,
fee effect on cash. Prices are mocked like in test_loader (no live yfinance).
"""

from datetime import UTC, datetime

import pandas as pd
import pytest

from sentinel_core.data import loader
from sentinel_core.paper import engine, ledger, valuation
from test_loader import DATES, patch_download

T0 = datetime(2026, 1, 2, 10, 0, tzinfo=UTC)


def tx(
    ticker: str,
    side: ledger.Side,
    quantity: int,
    price: float,
    txid: str | None = None,
    executed_at: datetime = T0,
    fees: float = 1.0,
) -> ledger.Transaction:
    return ledger.Transaction(
        **({"id": txid} if txid else {}),
        ticker=ticker,
        side=side,
        quantity=quantity,
        price=price,
        fees=fees,
        executed_at=executed_at,
    )


def price_frame(prices: dict[str, float]) -> pd.DataFrame:
    """Raw yfinance frame where every ticker trades flat at a fixed price."""
    columns = pd.MultiIndex.from_product([["Adj Close"], sorted(prices)])
    data = [[prices[t] for t in sorted(prices)]] * len(DATES)
    return pd.DataFrame(data, index=DATES, columns=columns)


# --- ledger: position derivation --------------------------------------------


def test_fractional_quantity_is_rejected():
    # Whole shares only in v1 — pydantic's ValidationError is a ValueError,
    # so the exception family stays consistent.
    with pytest.raises(ValueError, match="quantity"):
        tx("AAPL", "BUY", 0.5, 100.0)


def test_single_buy_creates_position():
    positions = ledger.positions_from_transactions([tx("AAPL", "BUY", 10, 100.0)])

    assert positions["AAPL"].quantity == 10
    assert positions["AAPL"].avg_buy_price == 100.0


def test_avg_buy_price_is_weighted_average_of_buys():
    positions = ledger.positions_from_transactions(
        [
            tx("AAPL", "BUY", 10, 100.0, executed_at=T0),
            tx("AAPL", "BUY", 10, 120.0, executed_at=T0.replace(hour=11)),
        ]
    )

    assert positions["AAPL"].quantity == 20
    assert positions["AAPL"].avg_buy_price == pytest.approx(110.0)


def test_partial_sell_reduces_quantity_but_keeps_avg_buy_price():
    positions = ledger.positions_from_transactions(
        [
            tx("AAPL", "BUY", 10, 100.0, executed_at=T0),
            tx("AAPL", "BUY", 10, 120.0, executed_at=T0.replace(hour=11)),
            tx("AAPL", "SELL", 5, 130.0, executed_at=T0.replace(hour=12)),
        ]
    )

    assert positions["AAPL"].quantity == 15
    assert positions["AAPL"].avg_buy_price == pytest.approx(110.0)


def test_full_sell_removes_position_and_rebuy_starts_fresh():
    transactions = [
        tx("AAPL", "BUY", 10, 100.0, executed_at=T0),
        tx("AAPL", "SELL", 10, 130.0, executed_at=T0.replace(hour=11)),
    ]
    assert ledger.positions_from_transactions(transactions) == {}

    transactions.append(tx("AAPL", "BUY", 5, 200.0, executed_at=T0.replace(hour=12)))
    positions = ledger.positions_from_transactions(transactions)

    assert positions["AAPL"].quantity == 5
    assert positions["AAPL"].avg_buy_price == 200.0  # old average is gone


def test_equal_timestamps_replay_deterministically_by_id():
    # BUY(a) -> SELL(b) -> BUY(c), all at the same instant. Only the id
    # tie-breaker makes this replayable: any list order must end with the
    # position from tx "c" alone (avg 120), never raise or yield avg 100.
    a = tx("AAPL", "BUY", 10, 100.0, txid="a")
    b = tx("AAPL", "SELL", 10, 110.0, txid="b")
    c = tx("AAPL", "BUY", 10, 120.0, txid="c")

    for shuffled in ([a, b, c], [c, b, a], [b, c, a]):
        positions = ledger.positions_from_transactions(shuffled)
        assert positions["AAPL"].quantity == 10
        assert positions["AAPL"].avg_buy_price == pytest.approx(120.0)


def test_replaying_sell_beyond_holdings_raises_with_amounts():
    transactions = [
        tx("NVDA", "BUY", 10, 100.0, executed_at=T0),
        tx("NVDA", "SELL", 15, 100.0, executed_at=T0.replace(hour=11)),
    ]

    with pytest.raises(ValueError, match=r"Verkauf von 15 Stück NVDA.*nur 10"):
        ledger.positions_from_transactions(transactions)


# --- ledger: cash and fees ---------------------------------------------------


def test_fees_hit_cash_on_both_buy_and_sell():
    cash = ledger.cash_from_transactions(
        1000.0,
        [
            tx("AAPL", "BUY", 5, 100.0, executed_at=T0),  # -501
            tx("AAPL", "SELL", 2, 110.0, executed_at=T0.replace(hour=11)),  # +219
        ],
    )

    assert cash == pytest.approx(1000.0 - 501.0 + 219.0)


def test_history_driving_cash_negative_raises():
    with pytest.raises(ValueError, match="Inkonsistente Transaktionshistorie"):
        ledger.cash_from_transactions(100.0, [tx("AAPL", "BUY", 5, 100.0)])


# --- engine: quote -----------------------------------------------------------


def test_quote_buy_includes_fee_and_negative_cash_delta(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))

    q = engine.quote("AAPL", 5, "BUY")

    assert q.price == 100.0
    assert q.fees == 1.0
    assert q.gross_value == pytest.approx(500.0)
    assert q.cash_delta == pytest.approx(-501.0)
    assert q.price_asof == DATES[-1].to_pydatetime()


def test_quote_sell_credits_gross_minus_fee(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))

    q = engine.quote("AAPL", 5, "SELL")

    assert q.cash_delta == pytest.approx(499.0)


def test_quote_rejects_non_positive_quantity(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))

    with pytest.raises(ValueError, match="Menge muss größer als 0"):
        engine.quote("AAPL", 0, "BUY")


# --- engine: execute ---------------------------------------------------------


def test_execute_buy_beyond_cash_is_hard_error(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))
    account = ledger.PaperAccount(start_cash=100.0)

    with pytest.raises(ValueError, match=r"Kauf von 2 Stück AAPL.*201\.00.*100\.00"):
        engine.execute(account, [], "AAPL", "BUY", 2)


def test_execute_sell_beyond_holdings_is_hard_error(monkeypatch):
    patch_download(monkeypatch, price_frame({"NVDA": 100.0}))
    account = ledger.PaperAccount()
    transactions = [tx("NVDA", "BUY", 10, 90.0)]

    with pytest.raises(ValueError, match=r"Verkauf von 15 Stück NVDA.*nur 10"):
        engine.execute(account, transactions, "NVDA", "SELL", 15)


def test_execute_buy_freezes_price_and_fee(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 123.0}))
    account = ledger.PaperAccount()

    trade = engine.execute(account, [], "AAPL", "BUY", 10)

    assert trade.side == "BUY"
    assert trade.price == 123.0
    assert trade.fees == 1.0
    assert trade.account_id == account.id
    assert trade.price_asof == DATES[-1].to_pydatetime()
    # the returned transaction replays into consistent state
    cash = ledger.cash_from_transactions(account.start_cash, [trade])
    assert cash == pytest.approx(10_000.0 - 1231.0)


def test_execute_all_in_buy_at_exact_cash_is_allowed(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))
    account = ledger.PaperAccount(start_cash=501.0)

    trade = engine.execute(account, [], "AAPL", "BUY", 5)

    assert trade.quantity == 5


# --- valuation ----------------------------------------------------------------


def test_valuation_combines_cash_positions_and_pnl(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 110.0}))
    account = ledger.PaperAccount(start_cash=10_000.0)
    transactions = [tx("AAPL", "BUY", 10, 100.0)]

    result = valuation.value_account(account, transactions)

    assert result.cash == pytest.approx(8_999.0)  # fee already deducted
    assert result.market_value == pytest.approx(1_100.0)
    assert result.total_value == pytest.approx(10_099.0)
    assert result.total_pnl == pytest.approx(99.0)  # +100 gain - 1 fee
    assert result.total_pnl_pct == pytest.approx(0.0099)
    (pos,) = result.positions
    assert pos.avg_buy_price == 100.0
    assert pos.unrealized_pnl == pytest.approx(100.0)


def test_valuation_of_cash_only_account_needs_no_prices(monkeypatch):
    def fail_download(*args, **kwargs):
        pytest.fail("loader must not be called for a cash-only account")

    monkeypatch.setattr(loader.yf, "download", fail_download)
    account = ledger.PaperAccount(start_cash=10_000.0)

    result = valuation.value_account(account, [])

    assert result.total_value == 10_000.0
    assert result.total_pnl == 0.0
    assert result.positions == []
