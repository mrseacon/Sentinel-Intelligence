"""Correlation matrix tests: known values, column-shuffle invariance (§4.2 —
this test must never be removed), <2 assets error.
"""

import pandas as pd
import pytest

from sentinel_core.risk.correlation import correlation_matrix
from test_risk_metrics import sample_returns


def test_identical_series_are_perfectly_correlated():
    base = sample_returns(["AAPL"])["AAPL"]
    returns = pd.DataFrame({"AAPL": base, "MSFT": base})

    result = correlation_matrix(returns)

    assert result["tickers"] == ["AAPL", "MSFT"]
    for row in result["matrix"]:
        assert row == pytest.approx([1.0, 1.0])


def test_inverted_series_are_perfectly_anticorrelated():
    base = sample_returns(["AAPL"])["AAPL"]
    returns = pd.DataFrame({"AAPL": base, "MSFT": -base})

    result = correlation_matrix(returns)

    assert result["matrix"][0] == pytest.approx([1.0, -1.0])
    assert result["matrix"][1] == pytest.approx([-1.0, 1.0])


def test_column_shuffle_must_not_change_result():
    # Same invariant as metrics/contribution (§3/§4.2): only ticker names
    # may determine the output, never column position. Output order is
    # additionally fixed (alphabetical) regardless of input order.
    returns = sample_returns()
    shuffled_returns = returns[["NVDA", "SAP.DE", "AAPL", "MSFT"]]

    original = correlation_matrix(returns)
    shuffled = correlation_matrix(shuffled_returns)

    assert original == shuffled


def test_tickers_are_returned_alphabetically_sorted():
    returns = sample_returns()[["NVDA", "AAPL", "SAP.DE", "MSFT"]]

    result = correlation_matrix(returns)

    assert result["tickers"] == sorted(result["tickers"])


def test_diagonal_is_always_one():
    returns = sample_returns()

    result = correlation_matrix(returns)

    for i in range(len(result["tickers"])):
        assert result["matrix"][i][i] == pytest.approx(1.0)


def test_single_asset_raises():
    returns = sample_returns(["AAPL"])

    with pytest.raises(ValueError, match="mindestens 2 Assets"):
        correlation_matrix(returns)
