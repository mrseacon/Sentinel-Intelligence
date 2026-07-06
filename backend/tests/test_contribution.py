"""Risk contribution tests: column-shuffle regression guard (§4.2) and the
sum-to-one property from KNOWLEDGE_EXTRACTION.md §12.
"""

import pandas as pd
import pytest

from sentinel_core.risk.contribution import risk_contribution
from test_risk_metrics import TICKERS, sample_returns


def test_column_shuffle_must_not_change_contributions():
    # Same invariant as for volatility/DR: alignment by ticker name only.
    returns = sample_returns()
    weights = {"AAPL": 0.4, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.1}
    shuffled_returns = returns[["NVDA", "SAP.DE", "AAPL", "MSFT"]]
    shuffled_weights = dict(reversed(list(weights.items())))

    original = risk_contribution(weights, returns)
    shuffled = risk_contribution(shuffled_weights, shuffled_returns)

    pd.testing.assert_series_equal(
        original.sort_index(), shuffled.sort_index(), check_names=False
    )


def test_contributions_sum_to_one():
    returns = sample_returns()
    weights = {t: 1.0 for t in TICKERS}

    assert risk_contribution(weights, returns).sum() == pytest.approx(1.0)


def test_single_asset_contributes_everything():
    returns = sample_returns(["AAPL"])

    result = risk_contribution({"AAPL": 1.0}, returns)

    assert result["AAPL"] == pytest.approx(1.0)


def test_contributions_are_scale_invariant():
    # Euro amounts and normalized fractions must give identical shares.
    returns = sample_returns()
    fractions = {"AAPL": 0.5, "MSFT": 0.3, "NVDA": 0.2}
    euros = {"AAPL": 5000.0, "MSFT": 3000.0, "NVDA": 2000.0}

    pd.testing.assert_series_equal(
        risk_contribution(fractions, returns),
        risk_contribution(euros, returns),
    )


def test_zero_variance_portfolio_raises():
    flat = pd.DataFrame(
        {"AAPL": [0.0] * 10, "MSFT": [0.0] * 10},
        index=pd.date_range("2026-01-02", periods=10, freq="B"),
    )

    with pytest.raises(ValueError, match="Portfolio-Varianz ist 0"):
        risk_contribution({"AAPL": 0.5, "MSFT": 0.5}, flat)
