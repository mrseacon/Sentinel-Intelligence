"""Ampel tests per ARCHITECTURE.md §9: threshold boundary cases for all
three lights, plus the regression guard for design principle 3 (never an
action recommendation for a specific security — legally relevant).
"""

import pandas as pd
import pytest

from sentinel_core.constants import (
    AMPEL_DR_GREEN_MIN,
    AMPEL_DR_YELLOW_MIN,
    AMPEL_HHI_GREEN_MAX,
    AMPEL_HHI_YELLOW_MAX,
    AMPEL_MIN_POSITIONS_GREEN,
    AMPEL_VOL_GREEN_MAX,
    AMPEL_VOL_YELLOW_MAX,
)
from sentinel_core.education import ampel
from test_risk_metrics import sample_returns


def alternating_returns(magnitude: float, tickers: list[str]) -> pd.DataFrame:
    """Deterministic returns alternating +x/-x: std is ~magnitude, and all
    columns are perfectly correlated (useful to force a red DR)."""
    values = [magnitude, -magnitude] * 50
    return pd.DataFrame(
        {t: values for t in tickers},
        index=pd.date_range("2026-01-02", periods=100, freq="B"),
    )


# --- threshold boundaries (§9: Ampel-Schwellen-Grenzfälle) -------------------


def test_concentration_status_boundaries():
    assert ampel.concentration_status(AMPEL_HHI_GREEN_MAX) == "green"
    assert ampel.concentration_status(AMPEL_HHI_GREEN_MAX + 1e-6) == "yellow"
    assert ampel.concentration_status(AMPEL_HHI_YELLOW_MAX) == "yellow"
    assert ampel.concentration_status(AMPEL_HHI_YELLOW_MAX + 1e-6) == "red"


def test_diversification_status_boundaries():
    n_green = AMPEL_MIN_POSITIONS_GREEN
    assert ampel.diversification_status(AMPEL_DR_GREEN_MIN, n_green) == "green"
    # enough spread but one position short of green
    assert ampel.diversification_status(AMPEL_DR_GREEN_MIN, n_green - 1) == "yellow"
    # enough positions but ratio just below green
    assert ampel.diversification_status(AMPEL_DR_GREEN_MIN - 1e-6, n_green) == "yellow"
    assert ampel.diversification_status(AMPEL_DR_YELLOW_MIN, 2) == "yellow"
    assert ampel.diversification_status(AMPEL_DR_YELLOW_MIN - 1e-6, 10) == "red"


def test_volatility_status_boundaries():
    assert ampel.volatility_status(AMPEL_VOL_GREEN_MAX) == "green"
    assert ampel.volatility_status(AMPEL_VOL_GREEN_MAX + 1e-6) == "yellow"
    assert ampel.volatility_status(AMPEL_VOL_YELLOW_MAX) == "yellow"
    assert ampel.volatility_status(AMPEL_VOL_YELLOW_MAX + 1e-6) == "red"


# --- integration: full Ampel objects -----------------------------------------


def test_concentration_red_names_the_concrete_trigger():
    result = ampel.concentration_ampel({"NVDA": 0.5, "AAPL": 0.3, "MSFT": 0.2})

    assert result.status == "red"
    assert result.value == pytest.approx(0.38)
    assert "NVDA" in result.explanation
    assert "50 %" in result.explanation
    assert "0,38" in result.explanation
    assert "NVDA" not in result.lesson


def test_concentration_yellow_and_green():
    yellow = ampel.concentration_ampel(
        {"AAPL": 0.3, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.2}
    )
    green = ampel.concentration_ampel({f"T{i}": 1.0 for i in range(8)})

    assert yellow.status == "yellow"
    assert yellow.value == pytest.approx(0.26)
    assert green.status == "green"
    assert green.value == pytest.approx(0.125)


def test_diversification_green_yellow_red():
    five = ["AAPL", "MSFT", "NVDA", "SAP.DE", "ALV.DE"]
    green = ampel.diversification_ampel({t: 1.0 for t in five}, sample_returns(five))
    yellow = ampel.diversification_ampel(
        {t: 1.0 for t in five[:4]}, sample_returns(five[:4])
    )
    red = ampel.diversification_ampel(
        {"AAPL": 0.5, "MSFT": 0.5}, alternating_returns(0.01, ["AAPL", "MSFT"])
    )

    assert green.status == "green"
    assert yellow.status == "yellow"  # spread is fine, but only 4 positions
    assert "4 Positionen" in yellow.explanation
    assert red.status == "red"
    assert red.value == pytest.approx(1.0)


def test_diversification_single_position_gets_dedicated_text():
    result = ampel.diversification_ampel(
        {"AAPL": 1.0}, alternating_returns(0.01, ["AAPL"])
    )

    assert result.status == "red"
    assert "einzigen Position" in result.explanation


def test_volatility_statuses_from_return_magnitude():
    green = ampel.volatility_ampel({"AAPL": 1.0}, alternating_returns(0.005, ["AAPL"]))
    yellow = ampel.volatility_ampel({"AAPL": 1.0}, alternating_returns(0.012, ["AAPL"]))
    red = ampel.volatility_ampel({"AAPL": 1.0}, alternating_returns(0.02, ["AAPL"]))

    assert green.status == "green"
    assert yellow.status == "yellow"
    assert red.status == "red"
    assert red.value == pytest.approx(0.319, abs=0.01)
    assert "pro Jahr" in red.explanation


# --- regression guard for principle 3 (no advice on securities) --------------

# Stems of German action verbs that would turn a description into an
# action recommendation. Deliberately checked against the WHOLE text, not
# just next to ticker names: even "kaufe breit gestreute ETFs" would cross
# the line (ARCHITECTURE §1, principle 3).
FORBIDDEN_ACTION_STEMS = [
    "kauf",  # also covers "verkauf" as substring; both listed for clarity
    "verkauf",
    "abstoß",
    "veräußer",
    "aufstock",
    "reduzier",
    "umschicht",
    "nachleg",
    "trenn dich",
]

SAMPLE_TICKERS = ["AAPL", "MSFT", "NVDA", "SAP.DE", "ALV.DE"]


def all_sample_ampeln() -> list[ampel.Ampel]:
    """One Ampel per (light, status) combination — texts of every branch."""
    five = SAMPLE_TICKERS
    return [
        ampel.concentration_ampel({"NVDA": 0.5, "AAPL": 0.3, "MSFT": 0.2}),
        ampel.concentration_ampel(
            {"AAPL": 0.3, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.2}
        ),
        ampel.concentration_ampel({t: 1.0 for t in five + ["MBG.DE", "SIE.DE"]}),
        ampel.diversification_ampel({t: 1.0 for t in five}, sample_returns(five)),
        ampel.diversification_ampel(
            {t: 1.0 for t in five[:4]}, sample_returns(five[:4])
        ),
        ampel.diversification_ampel(
            {"AAPL": 0.5, "MSFT": 0.5}, alternating_returns(0.01, ["AAPL", "MSFT"])
        ),
        ampel.diversification_ampel({"AAPL": 1.0}, alternating_returns(0.01, ["AAPL"])),
        ampel.volatility_ampel({"AAPL": 1.0}, alternating_returns(0.005, ["AAPL"])),
        ampel.volatility_ampel({"AAPL": 1.0}, alternating_returns(0.012, ["AAPL"])),
        ampel.volatility_ampel({"AAPL": 1.0}, alternating_returns(0.02, ["AAPL"])),
    ]


def test_texts_never_recommend_actions_for_securities():
    ampeln = all_sample_ampeln()
    # sanity: the samples must actually cover all three statuses
    assert {a.status for a in ampeln} == {"green", "yellow", "red"}

    for result in ampeln:
        text = f"{result.explanation} {result.lesson}".lower()
        for stem in FORBIDDEN_ACTION_STEMS:
            assert stem not in text, (
                f"Ampel '{result.name}' ({result.status}) enthält "
                f"Handlungsverb-Stamm '{stem}': {text[:200]}"
            )


def test_lessons_are_static_and_ticker_free():
    for result in all_sample_ampeln():
        for ticker in SAMPLE_TICKERS:
            assert ticker.lower() not in result.lesson.lower(), (
                f"Lernkarte der Ampel '{result.name}' nennt Wertpapier "
                f"{ticker} — Lektionen müssen titel-frei bleiben."
            )
