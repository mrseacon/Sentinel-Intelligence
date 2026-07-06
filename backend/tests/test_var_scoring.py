"""Mandatory VaR/CVaR and scoring tests per ARCHITECTURE.md §9:
CVaR <= VaR invariant, empty tail -> VaR fallback, score composition with
known inputs against the documented anchors and weights (§5).
"""

import numpy as np
import pandas as pd
import pytest

from sentinel_core.risk import var as var_module
from sentinel_core.risk.scoring import risk_score, score_label, score_portfolio
from sentinel_core.risk.var import historical_cvar, historical_var
from test_risk_metrics import sample_returns

KNOWN_RETURNS = pd.Series([-0.10, -0.05, 0.0, 0.05, 0.10])


# --- VaR / CVaR ---------------------------------------------------------------


def test_var_is_negative_in_return_space():
    # 5th percentile with linear interpolation: -0.10 + 0.2 * 0.05 = -0.09
    assert historical_var(KNOWN_RETURNS) == pytest.approx(-0.09)


def test_cvar_is_tail_mean_and_leq_var():
    var = historical_var(KNOWN_RETURNS)
    cvar = historical_cvar(KNOWN_RETURNS)

    assert cvar == pytest.approx(-0.10)  # tail is just the worst return
    assert cvar <= var


def test_cvar_leq_var_invariant_on_random_series():
    rng = np.random.default_rng(11)
    for _ in range(5):
        returns = pd.Series(rng.normal(0.0, 0.02, size=250))
        assert historical_cvar(returns) <= historical_var(returns)


def test_empty_tail_falls_back_to_var(monkeypatch):
    # Force a VaR below the sample minimum so `returns <= var` matches
    # nothing — the fallback must return the VaR itself, never NaN (§4).
    forced_var = -0.5
    monkeypatch.setattr(
        var_module, "historical_var", lambda returns, confidence=0.95: forced_var
    )

    cvar = var_module.historical_cvar(KNOWN_RETURNS)

    assert cvar == forced_var
    assert not np.isnan(cvar)


def test_var_rejects_empty_series_and_bad_confidence():
    with pytest.raises(ValueError, match="Keine Renditedaten"):
        historical_var(pd.Series(dtype=float))
    with pytest.raises(ValueError, match="Konfidenzniveau"):
        historical_var(KNOWN_RETURNS, confidence=1.5)


# --- scoring ------------------------------------------------------------------


def test_riskless_portfolio_scores_zero_with_no_drivers():
    result = risk_score(volatility=0.0, max_dd=0.0, var_95=0.0, cvar_95=0.0, hhi=0.10)

    assert result.score == 0
    assert result.label == "Low"
    assert result.drivers == []


def test_score_composition_at_half_anchors():
    # Every factor at exactly half its anchor -> each component 0.5, so the
    # score is 100 * 0.5 * (0.30+0.30+0.20+0.15+0.05) = 50.
    result = risk_score(
        volatility=0.20,  # anchor 0.40
        max_dd=-0.25,  # anchor 0.50
        var_95=-0.025,  # anchor 0.05
        cvar_95=-0.04,  # anchor 0.08
        hhi=0.20,  # (0.20 - 0.10) / 0.20 = 0.5
    )

    assert result.score == pytest.approx(50.0)
    assert result.label == "Moderate"
    assert result.components == pytest.approx(
        {
            "volatility": 0.5,
            "max_drawdown": 0.5,
            "var_95": 0.5,
            "cvar_95": 0.5,
            "concentration": 0.5,
        }
    )
    # top-3 drivers: vol and drawdown dominate by design, then VaR
    assert [d.name for d in result.drivers] == [
        "volatility",
        "max_drawdown",
        "var_95",
    ]
    assert result.drivers[0].contribution == pytest.approx(0.15)


def test_score_clamps_at_anchors_to_100():
    at_anchors = risk_score(
        volatility=0.40, max_dd=-0.50, var_95=-0.05, cvar_95=-0.08, hhi=0.30
    )
    beyond = risk_score(
        volatility=0.80, max_dd=-0.90, var_95=-0.20, cvar_95=-0.30, hhi=0.90
    )

    assert at_anchors.score == pytest.approx(100.0)
    assert at_anchors.label == "Severe"
    assert beyond.score == pytest.approx(100.0)


def test_single_asset_concentration_none_caps_score_at_95():
    result = risk_score(
        volatility=0.40, max_dd=-0.50, var_95=-0.05, cvar_95=-0.08, hhi=None
    )

    assert result.score == pytest.approx(95.0)
    assert "concentration" not in result.components


def test_score_label_boundaries():
    assert score_label(25) == "Low"
    assert score_label(25.1) == "Moderate"
    assert score_label(50) == "Moderate"
    assert score_label(75) == "High"
    assert score_label(75.1) == "Severe"


def test_negative_volatility_is_rejected():
    with pytest.raises(ValueError, match="Volatilität darf nicht negativ"):
        risk_score(volatility=-0.1, max_dd=0.0, var_95=0.0, cvar_95=0.0, hhi=None)


def test_score_portfolio_wires_all_factors():
    returns = sample_returns()
    weights = {"AAPL": 0.4, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.1}

    result = score_portfolio(weights, returns)

    assert 0 <= result.score <= 100
    assert "concentration" in result.components
    assert result.drivers  # something always drives a real portfolio


def test_score_portfolio_single_asset_has_no_concentration():
    result = score_portfolio({"AAPL": 1.0}, sample_returns(["AAPL"]))

    assert "concentration" not in result.components
