"""Optimizer tests per ARCHITECTURE.md §9: constraints hold (sum=1,
bounds), convergence on a known symmetric case, speaking error on
non-convergence, column-shuffle invariance of the covariance handling.
"""

import numpy as np
import pandas as pd
import pytest

from sentinel_core.constants import OPTIMIZER_MAX_WEIGHT
from sentinel_core.portfolio import optimization
from sentinel_core.portfolio.optimization import optimize_max_sharpe
from test_risk_metrics import sample_returns

DATES_120 = pd.date_range("2026-01-02", periods=120, freq="B")


def symmetric_uncorrelated_pair() -> pd.DataFrame:
    """Two assets with identical mean/vol and zero correlation.

    Cycle construction: B is A shifted by one step, so over each cycle
    the cross products cancel exactly. By symmetry the max-Sharpe
    solution is 50/50.
    """
    base, x, y = 0.005, 0.02, 0.01
    cycle_a = [x, y, -x, -y]
    cycle_b = [y, -x, -y, x]
    return pd.DataFrame(
        {
            "A": [base + v for v in cycle_a * 30],
            "B": [base + v for v in cycle_b * 30],
        },
        index=DATES_120,
    )


def test_constraints_hold_on_random_portfolio():
    returns = sample_returns()

    result = optimize_max_sharpe(returns)

    weights = np.array(list(result.weights.values()))
    assert weights.sum() == pytest.approx(1.0)
    assert (weights >= -1e-9).all()  # long-only
    assert (weights <= OPTIMIZER_MAX_WEIGHT + 1e-9).all()
    assert set(result.weights) == set(returns.columns)


def test_symmetric_uncorrelated_assets_get_equal_weights():
    result = optimize_max_sharpe(symmetric_uncorrelated_pair())

    assert result.weights["A"] == pytest.approx(0.5, abs=0.02)
    assert result.weights["B"] == pytest.approx(0.5, abs=0.02)
    assert result.sharpe > 0


def test_dominant_asset_is_capped_at_max_weight():
    # A dominates on return at equal vol — unconstrained max-Sharpe would
    # go (almost) all-in, the per-asset cap must bind instead (§11).
    rng = np.random.default_rng(21)
    returns = pd.DataFrame(
        {
            "STRONG": rng.normal(0.004, 0.01, 120),
            "WEAK": rng.normal(0.0, 0.01, 120),
        },
        index=DATES_120,
    )

    result = optimize_max_sharpe(returns)

    assert result.weights["STRONG"] == pytest.approx(OPTIMIZER_MAX_WEIGHT, abs=1e-3)
    assert result.weights["WEAK"] == pytest.approx(1 - OPTIMIZER_MAX_WEIGHT, abs=1e-3)


def test_column_shuffle_must_not_change_optimal_weights():
    returns = sample_returns()
    shuffled = returns[["NVDA", "SAP.DE", "AAPL", "MSFT"]]

    original = optimize_max_sharpe(returns)
    permuted = optimize_max_sharpe(shuffled)

    for ticker in returns.columns:
        assert original.weights[ticker] == pytest.approx(
            permuted.weights[ticker], abs=1e-5
        )


def test_non_convergence_raises_speaking_german_error(monkeypatch):
    from types import SimpleNamespace

    def failing_minimize(*args, **kwargs):
        return SimpleNamespace(
            success=False, message="Iteration limit exceeded", x=None, fun=None
        )

    monkeypatch.setattr(optimization, "minimize", failing_minimize)

    with pytest.raises(ValueError, match="nicht konvergiert.*Iteration limit exceeded"):
        optimize_max_sharpe(symmetric_uncorrelated_pair())


def test_nan_gaps_are_rejected_with_speaking_error():
    returns = sample_returns(["AAPL", "MSFT"]).copy()
    returns.iloc[0, 0] = np.nan

    with pytest.raises(ValueError, match="Lücken.*AAPL.*daily_returns"):
        optimize_max_sharpe(returns)


def test_constant_returns_raise_value_error_not_zero_division():
    # Zero volatility everywhere: Sharpe is undefined. Must stay inside
    # the project's ValueError family instead of ZeroDivisionError.
    flat = pd.DataFrame({"A": [0.01] * 60, "B": [0.01] * 60})

    with pytest.raises(ValueError, match="degeneriert|nicht konvergiert"):
        optimize_max_sharpe(flat)


def test_single_asset_is_rejected():
    returns = sample_returns(["AAPL"])

    with pytest.raises(ValueError, match="mindestens 2 Assets"):
        optimize_max_sharpe(returns)


def test_too_short_history_is_rejected():
    returns = pd.DataFrame(
        {"A": [0.01], "B": [0.02]}, index=pd.date_range("2026-01-02", periods=1)
    )

    with pytest.raises(ValueError, match="Zu wenige Datenpunkte"):
        optimize_max_sharpe(returns)
