"""Stress replay tests (STRESS_TEST_DECISIONS.md / ARCHITECTURE §9):
exclusion before return computation, renormalization, coverage threshold,
cache behaviour, shuffle invariance and the action-verb regression guard
extended to the new texts.
"""

from datetime import date

import numpy as np
import pandas as pd
import pytest

from sentinel_core.constants import STRESS_PRESETS
from sentinel_core.data import loader
from sentinel_core.education.explanations import STRESS_DISCLAIMER, STRESS_LESSONS
from sentinel_core.stress import replay as stress
from test_ampel import FORBIDDEN_ACTION_STEMS

GFC_WINDOW = pd.bdate_range("2007-10-09", "2009-03-09")


def declining_series(index: pd.DatetimeIndex) -> pd.Series:
    """Deterministic price path halving over the window."""
    return pd.Series(np.linspace(100.0, 50.0, len(index)), index=index)


def fake_market(
    monkeypatch: pytest.MonkeyPatch, market: dict[str, pd.Series | None]
) -> list[str]:
    """Serve per-ticker series like yfinance would; None = no data.

    Returns the list of fetched tickers so tests can count yfinance calls.
    """
    calls: list[str] = []

    def fake_download(tickers, period=None, start=None, end=None, **kwargs):
        assert kwargs.get("auto_adjust") is False
        ticker = tickers[0] if isinstance(tickers, list) else tickers
        calls.append(ticker)
        series = market.get(ticker)
        if series is None:
            return pd.DataFrame()
        frame = series.to_frame()
        frame.columns = pd.MultiIndex.from_product([["Adj Close"], [ticker]])
        return frame

    monkeypatch.setattr(loader.yf, "download", fake_download)
    return calls


def test_presets_match_verified_peak_to_trough_dates():
    preset = stress.get_preset("gfc_2008")

    assert preset.start == date(2007, 10, 9)
    assert preset.end == date(2009, 3, 9)
    assert set(STRESS_PRESETS) == {"gfc_2008", "covid_2020", "rates_2022"}


def test_unknown_preset_is_rejected_by_name(tmp_path):
    with pytest.raises(ValueError, match="Unbekanntes Krisen-Szenario.*dotcom"):
        stress.replay({"AAPL": 1.0}, "dotcom", cache_dir=tmp_path)


def test_missing_asset_is_excluded_and_rest_renormalized(monkeypatch, tmp_path):
    fake_market(
        monkeypatch,
        {
            "OLD1": declining_series(GFC_WINDOW),
            "OLD2": declining_series(GFC_WINDOW) * 2,
            "YOUNG": None,  # listed after the crisis
        },
    )

    with_young = stress.replay(
        {"OLD1": 0.4, "OLD2": 0.4, "YOUNG": 0.2}, "gfc_2008", cache_dir=tmp_path
    )
    without_young = stress.replay(
        {"OLD1": 0.5, "OLD2": 0.5}, "gfc_2008", cache_dir=tmp_path
    )

    assert with_young.excluded_tickers == ["YOUNG"]
    assert with_young.included_tickers == ["OLD1", "OLD2"]
    assert with_young.coverage == pytest.approx(0.8)
    # renormalization: 0.4/0.4 must behave exactly like 0.5/0.5
    assert with_young.value_path == pytest.approx(without_young.value_path)
    assert with_young.max_drawdown == pytest.approx(without_young.max_drawdown)
    assert "YOUNG" in with_young.explanation
    assert "80 %" in with_young.explanation


def test_below_minimum_coverage_is_rejected_with_speaking_message(
    monkeypatch, tmp_path
):
    fake_market(
        monkeypatch,
        {"OLD1": declining_series(GFC_WINDOW), "YOUNG": None},
    )

    with pytest.raises(ValueError, match=r"nicht aussagekräftig.*40 %.*YOUNG"):
        stress.replay({"YOUNG": 0.6, "OLD1": 0.4}, "gfc_2008", cache_dir=tmp_path)


def test_late_ipo_is_excluded_instead_of_truncating_the_window(monkeypatch, tmp_path):
    # MIDIPO starts trading mid-window. If it were included, daily_returns'
    # dropna() would silently shrink the whole window to its history.
    mid_index = GFC_WINDOW[GFC_WINDOW >= "2008-06-02"]
    fake_market(
        monkeypatch,
        {
            "OLD1": declining_series(GFC_WINDOW),
            "MIDIPO": declining_series(mid_index),
        },
    )

    result = stress.replay({"OLD1": 0.6, "MIDIPO": 0.4}, "gfc_2008", cache_dir=tmp_path)

    assert result.excluded_tickers == ["MIDIPO"]
    assert result.dates[0] == date(2007, 10, 9)  # full window preserved
    assert len(result.dates) == len(GFC_WINDOW)


def test_second_call_is_served_from_cache_without_yfinance(monkeypatch, tmp_path):
    calls = fake_market(
        monkeypatch,
        {
            "OLD1": declining_series(GFC_WINDOW),
            "OLD2": declining_series(GFC_WINDOW),
            "YOUNG": None,
        },
    )
    weights = {"OLD1": 0.4, "OLD2": 0.4, "YOUNG": 0.2}

    stress.replay(weights, "gfc_2008", cache_dir=tmp_path)
    assert sorted(calls) == ["OLD1", "OLD2", "YOUNG"]

    stress.replay(weights, "gfc_2008", cache_dir=tmp_path)
    # no new fetches — negative results (YOUNG) are cached too
    assert sorted(calls) == ["OLD1", "OLD2", "YOUNG"]


def test_shuffled_weights_dict_gives_identical_result(monkeypatch, tmp_path):
    fake_market(
        monkeypatch,
        {
            "OLD1": declining_series(GFC_WINDOW),
            "OLD2": declining_series(GFC_WINDOW) * 3,
        },
    )
    weights = {"OLD1": 0.7, "OLD2": 0.3}

    original = stress.replay(weights, "gfc_2008", cache_dir=tmp_path)
    shuffled = stress.replay(
        dict(reversed(list(weights.items()))), "gfc_2008", cache_dir=tmp_path
    )

    assert original.value_path == pytest.approx(shuffled.value_path)
    assert original.max_drawdown == pytest.approx(shuffled.max_drawdown)
    assert original.volatility == pytest.approx(shuffled.volatility)


def test_stress_texts_never_recommend_actions(monkeypatch, tmp_path):
    # Same guard as for the Ampel texts (principle 3), extended to the
    # replay explanation, the preset lessons and the disclaimer.
    fake_market(
        monkeypatch,
        {"OLD1": declining_series(GFC_WINDOW), "YOUNG": None},
    )
    result = stress.replay({"OLD1": 0.8, "YOUNG": 0.2}, "gfc_2008", cache_dir=tmp_path)

    texts = [result.explanation, result.disclaimer, *STRESS_LESSONS.values()]
    for text in texts:
        for stem in FORBIDDEN_ACTION_STEMS:
            assert (
                stem not in text.lower()
            ), f"Stress-Text enthält Handlungsverb-Stamm '{stem}': {text[:200]}"

    # lessons and disclaimer are static concept content: ticker-free
    for text in [STRESS_DISCLAIMER, *STRESS_LESSONS.values()]:
        for ticker in ["OLD1", "YOUNG", "AAPL", "NVDA", "MSFT"]:
            assert ticker.lower() not in text.lower()
