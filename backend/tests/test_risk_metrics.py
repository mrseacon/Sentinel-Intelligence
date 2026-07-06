"""Mandatory risk metric tests per ARCHITECTURE.md §9: column-shuffle
invariance (§4.2 — this test must never be removed), HHI self-normalization,
defensive weight renormalization at every entry point.
"""

import numpy as np
import pandas as pd
import pytest

from sentinel_core.constants import TRADING_DAYS
from sentinel_core.risk import metrics

TICKERS = ["AAPL", "MSFT", "NVDA", "SAP.DE"]


def sample_returns(columns: list[str] = TICKERS, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        rng.normal(0.0005, 0.01, size=(120, len(columns))),
        columns=columns,
        index=pd.date_range("2026-01-02", periods=120, freq="B"),
    )


def test_column_shuffle_must_not_change_results():
    # THE invariant from the legacy project (§3/§4.2): metrics align weights
    # and covariance by ticker name, so neither shuffled return columns nor
    # a reordered weights dict may change any result. Never remove this test.
    returns = sample_returns()
    weights = {"AAPL": 0.4, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.1}
    shuffled_returns = returns[["NVDA", "SAP.DE", "AAPL", "MSFT"]]
    shuffled_weights = dict(reversed(list(weights.items())))

    assert metrics.portfolio_volatility(weights, returns) == pytest.approx(
        metrics.portfolio_volatility(shuffled_weights, shuffled_returns)
    )
    assert metrics.diversification_ratio(weights, returns) == pytest.approx(
        metrics.diversification_ratio(shuffled_weights, shuffled_returns)
    )


def test_weights_are_renormalized_at_entry():
    # Callers may pass euro amounts or share counts (§10) — any positive
    # scaling must be irrelevant.
    returns = sample_returns()
    fractions = {"AAPL": 0.5, "MSFT": 0.3, "NVDA": 0.2}
    euro_amounts = {"AAPL": 5000.0, "MSFT": 3000.0, "NVDA": 2000.0}

    assert metrics.portfolio_volatility(fractions, returns) == pytest.approx(
        metrics.portfolio_volatility(euro_amounts, returns)
    )
    assert metrics.herfindahl_index(fractions) == pytest.approx(
        metrics.herfindahl_index(euro_amounts)
    )


def test_hhi_self_normalizes_and_equals_one_over_n_for_equal_weights():
    assert metrics.herfindahl_index({"A": 50.0, "B": 50.0}) == pytest.approx(0.5)
    equal = {t: 1.0 for t in ["A", "B", "C", "D"]}
    assert metrics.herfindahl_index(equal) == pytest.approx(0.25)


def test_hhi_rejects_non_positive_weight_sum():
    with pytest.raises(ValueError, match="Summe der Gewichte"):
        metrics.herfindahl_index({"A": 0.0, "B": 0.0})


def test_negative_weights_are_rejected_by_name():
    with pytest.raises(ValueError, match="Negative Gewichte.*MSFT"):
        metrics.normalize_weights({"AAPL": 0.8, "MSFT": -0.2})


def test_ticker_without_return_data_is_named():
    returns = sample_returns(["AAPL", "MSFT"])

    with pytest.raises(ValueError, match="Keine Renditedaten.*NVDA"):
        metrics.portfolio_volatility({"AAPL": 0.5, "NVDA": 0.5}, returns)


def test_single_asset_volatility_matches_annualized_std():
    returns = sample_returns(["AAPL"])
    expected = float(returns["AAPL"].std(ddof=1) * np.sqrt(TRADING_DAYS))

    assert metrics.portfolio_volatility({"AAPL": 1.0}, returns) == pytest.approx(
        expected
    )


def test_diversification_ratio_is_one_for_single_asset():
    returns = sample_returns(["AAPL"])

    assert metrics.diversification_ratio({"AAPL": 1.0}, returns) == pytest.approx(1.0)


def test_diversification_ratio_above_one_for_uncorrelated_assets():
    returns = sample_returns()
    weights = {t: 1.0 for t in TICKERS}

    assert metrics.diversification_ratio(weights, returns) > 1.0


def test_portfolio_returns_shuffle_must_not_change_results():
    # Mandatory shuffle case for the new entry point: portfolio_returns
    # aligns by ticker name, so column and dict order must be irrelevant.
    returns = sample_returns()
    weights = {"AAPL": 0.4, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.1}
    shuffled_returns = returns[["SAP.DE", "NVDA", "MSFT", "AAPL"]]
    shuffled_weights = dict(reversed(list(weights.items())))

    pd.testing.assert_series_equal(
        metrics.portfolio_returns(weights, returns),
        metrics.portfolio_returns(shuffled_weights, shuffled_returns),
    )


def test_portfolio_returns_known_values():
    returns = pd.DataFrame(
        {"AAPL": [0.1, 0.2], "MSFT": [-0.1, 0.0]},
        index=pd.date_range("2026-01-02", periods=2, freq="B"),
    )

    result = metrics.portfolio_returns({"AAPL": 0.5, "MSFT": 0.5}, returns)

    assert result.tolist() == pytest.approx([0.0, 0.1])


def test_max_drawdown_known_value():
    # 1.0 -> 1.1 -> 0.55 -> 0.6875: trough is 50 % below the 1.1 peak
    returns = pd.Series([0.1, -0.5, 0.25])

    assert metrics.max_drawdown(returns) == pytest.approx(-0.5)


def test_max_drawdown_of_empty_series_raises():
    with pytest.raises(ValueError, match="Keine Renditedaten"):
        metrics.max_drawdown(pd.Series(dtype=float))


def test_daily_returns_are_simple_pct_change():
    prices = pd.DataFrame(
        {"AAPL": [100.0, 110.0, 121.0]},
        index=pd.date_range("2026-01-02", periods=3, freq="B"),
    )

    returns = metrics.daily_returns(prices)

    assert len(returns) == 2  # first row dropped
    assert returns["AAPL"].tolist() == pytest.approx([0.1, 0.1])
