"""Monte Carlo simulation tests (MONTE_CARLO_DECISIONS.md guardrails):
deterministic seed, percentile ordering, correlation preservation,
minimum-history boundary, transparency fields incl. recycling factor,
shuffle invariance and the extended action-verb guard.
"""

import numpy as np
import pandas as pd
import pytest

from sentinel_core.constants import SIM_MIN_HISTORY_DAYS, SIM_N_PATHS, SIM_SEED
from sentinel_core.education.explanations import SIM_DISCLAIMER, SIM_LESSON
from sentinel_core.simulation.monte_carlo import simulate
from test_ampel import FORBIDDEN_ACTION_STEMS


def history(days: int, columns: list[str], seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        rng.normal(0.0004, 0.01, size=(days, len(columns))),
        columns=columns,
        index=pd.bdate_range("2021-01-04", periods=days),
    )


WEIGHTS = {"AAPL": 0.6, "MSFT": 0.4}


def test_same_input_produces_identical_fan():
    returns = history(500, ["AAPL", "MSFT"])

    first = simulate(WEIGHTS, 1, returns=returns)
    second = simulate(WEIGHTS, 1, returns=returns)

    assert first.p10 == second.p10
    assert first.p50 == second.p50
    assert first.p90 == second.p90
    assert first.seed == SIM_SEED
    assert first.n_paths == SIM_N_PATHS


def test_fan_structure_and_percentile_order_at_every_support_point():
    result = simulate(WEIGHTS, 1, returns=history(500, ["AAPL", "MSFT"]))

    assert result.trading_days[0] == 0
    assert result.trading_days[-1] == 252  # 1 year horizon
    assert result.p10[0] == result.p50[0] == result.p90[0] == 1.0
    for low, mid, high in zip(result.p10, result.p50, result.p90, strict=True):
        assert low <= mid <= high
    assert result.final_p10 == result.p10[-1]
    assert result.final_p90 == result.p90[-1]


def test_correlation_is_preserved_not_destroyed():
    # Perfectly anti-correlated pair: the portfolio return is exactly 0
    # every day, so the fan must collapse to a line. The same asset with a
    # zero-correlation partner gives a clearly wider fan. If assets were
    # resampled independently, the anti-correlated fan would look like the
    # zero-correlation one — the smoothed-out mistake the decision doc
    # explicitly forbids (§2).
    x = 0.02
    dates = pd.bdate_range("2021-01-04", periods=600)
    anti = pd.DataFrame({"A": [x, -x] * 300, "B": [-x, x] * 300}, index=dates)
    uncorrelated = pd.DataFrame(
        {"A": [x, -x] * 300, "B": [x, x, -x, -x] * 150}, index=dates
    )
    weights = {"A": 0.5, "B": 0.5}

    anti_fan = simulate(weights, 1, returns=anti)
    wide_fan = simulate(weights, 1, returns=uncorrelated)

    anti_width = anti_fan.final_p90 - anti_fan.final_p10
    wide_width = wide_fan.final_p90 - wide_fan.final_p10
    assert anti_width == pytest.approx(0.0, abs=1e-12)
    assert wide_width > 0.01
    assert anti_width < wide_width


def test_invalid_horizon_is_rejected():
    with pytest.raises(ValueError, match="Zeithorizont muss 1, 5, 10"):
        simulate(WEIGHTS, 3, returns=history(500, ["AAPL", "MSFT"]))


def test_minimum_history_boundary():
    too_short = history(SIM_MIN_HISTORY_DAYS - 1, ["AAPL", "MSFT"])
    just_enough = history(SIM_MIN_HISTORY_DAYS, ["AAPL", "MSFT"])

    with pytest.raises(ValueError, match="Zu wenig Kurshistorie.*249"):
        simulate(WEIGHTS, 1, returns=too_short)
    assert simulate(WEIGHTS, 1, returns=just_enough).history_days == 250


def test_transparency_fields_come_from_the_simulated_returns():
    # B starts 300 days later: the common history is 300 days, B is the
    # limiting ticker, and a 10-year horizon recycles it ~8.4 times. All
    # of this must be derived from the very frame that gets simulated.
    returns = history(600, ["AAPL", "B"])
    returns.iloc[:300, returns.columns.get_loc("B")] = np.nan

    result = simulate({"AAPL": 0.5, "B": 0.5}, 10, returns=returns)

    assert result.history_days == 300
    assert result.limiting_ticker == "B"
    assert result.recycling_factor == pytest.approx(2520 / 300)
    assert result.history_years == pytest.approx(300 / 252)
    assert result.thin_history is True
    assert "begrenzt durch B" in result.explanation
    assert "wiederverwendet" in result.explanation
    assert "8,4" in result.explanation  # recycling factor, German format


def test_long_equal_histories_have_no_limiter_and_no_thin_warning():
    # 800 days ≈ 3.2 years: above the thin-history threshold
    result = simulate(WEIGHTS, 1, returns=history(800, ["AAPL", "MSFT"]))

    assert result.limiting_ticker is None
    assert result.thin_history is False
    assert "wiederverwendet" not in result.explanation


def test_shuffled_weights_and_columns_give_identical_fan():
    returns = history(500, ["AAPL", "MSFT"])
    shuffled_returns = returns[["MSFT", "AAPL"]]
    shuffled_weights = dict(reversed(list(WEIGHTS.items())))

    original = simulate(WEIGHTS, 1, returns=returns)
    shuffled = simulate(shuffled_weights, 1, returns=shuffled_returns)

    # approx, not ==: reordered columns change the BLAS summation order in
    # the dot product by one ULP (~1e-18) — value equality is the invariant
    assert original.p10 == pytest.approx(shuffled.p10)
    assert original.p50 == pytest.approx(shuffled.p50)
    assert original.p90 == pytest.approx(shuffled.p90)


def test_simulation_texts_never_recommend_actions():
    # Extension of the ampel/stress guard (principle 3) to the new texts.
    result = simulate(
        {"AAPL": 0.5, "NVDA": 0.5}, 1, returns=history(300, ["AAPL", "NVDA"])
    )

    for text in [result.explanation, SIM_LESSON, SIM_DISCLAIMER]:
        for stem in FORBIDDEN_ACTION_STEMS:
            assert stem not in text.lower(), (
                f"Simulations-Text enthält Handlungsverb-Stamm '{stem}': "
                f"{text[:200]}"
            )

    # lesson and disclaimer are static concept content: ticker-free
    for text in [SIM_LESSON, SIM_DISCLAIMER]:
        for ticker in ["AAPL", "NVDA", "MSFT"]:
            assert ticker.lower() not in text.lower()
