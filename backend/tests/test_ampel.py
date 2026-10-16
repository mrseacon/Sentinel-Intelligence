"""Ampel tests per ARCHITECTURE.md §9: threshold boundary cases for all
three lights, plus the regression guard for design principle 3 (never an
action recommendation for a specific security — legally relevant).
"""

import re

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

# English counterpart, as word-boundary regexes instead of substrings so
# descriptive phrases like "sell-off" or "short history" don't trip it.
FORBIDDEN_ACTION_PATTERNS_EN = [
    r"\bbuy\w*",
    r"\bsell(?!-off)\w*",
    r"\bpurchas\w*",
    r"\bdump\w*",
    r"\btrim\w*",
    r"\boverweight\w*",
    r"\bunderweight\w*",
    r"\baccumulat\w*",
    r"\bshort[- ]sell\w*",
    r"\bgo short\b",
    r"\byou should\b",
    r"\bwe recommend\b",
    r"\bconsider (?:buying|selling|adding|reducing|increasing)\b",
    r"\b(?:increase|reduce|cut|add to) your (?:position|holding|stake)\w*",
    r"\btake profits?\b",
    r"\bget rid of\b",
]


def find_action_language(text: str, lang: str) -> str | None:
    """Return the first forbidden action term in `text`, or None."""
    lowered = text.lower()
    if lang == "de":
        return next((s for s in FORBIDDEN_ACTION_STEMS if s in lowered), None)
    for pattern in FORBIDDEN_ACTION_PATTERNS_EN:
        match = re.search(pattern, lowered)
        if match:
            return match.group(0)
    return None


SAMPLE_TICKERS = ["AAPL", "MSFT", "NVDA", "SAP.DE", "ALV.DE"]


def all_sample_ampeln(lang: str = "de") -> list[ampel.Ampel]:
    """One Ampel per (light, status) combination — texts of every branch."""
    five = SAMPLE_TICKERS
    return [
        ampel.concentration_ampel({"NVDA": 0.5, "AAPL": 0.3, "MSFT": 0.2}, lang),
        ampel.concentration_ampel(
            {"AAPL": 0.3, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.2}, lang
        ),
        ampel.concentration_ampel({t: 1.0 for t in five + ["MBG.DE", "SIE.DE"]}, lang),
        # red with more than three positions: covers the top-3 clause
        ampel.concentration_ampel(
            {"NVDA": 0.7, "AAPL": 0.1, "MSFT": 0.1, "SAP.DE": 0.1}, lang
        ),
        ampel.diversification_ampel({t: 1.0 for t in five}, sample_returns(five), lang),
        ampel.diversification_ampel(
            {t: 1.0 for t in five[:4]}, sample_returns(five[:4]), lang
        ),
        ampel.diversification_ampel(
            {"AAPL": 0.5, "MSFT": 0.5},
            alternating_returns(0.01, ["AAPL", "MSFT"]),
            lang,
        ),
        ampel.diversification_ampel(
            {"AAPL": 1.0}, alternating_returns(0.01, ["AAPL"]), lang
        ),
        ampel.volatility_ampel(
            {"AAPL": 1.0}, alternating_returns(0.005, ["AAPL"]), lang
        ),
        ampel.volatility_ampel(
            {"AAPL": 1.0}, alternating_returns(0.012, ["AAPL"]), lang
        ),
        ampel.volatility_ampel(
            {"AAPL": 1.0}, alternating_returns(0.02, ["AAPL"]), lang
        ),
    ]


@pytest.mark.parametrize("lang", ["de", "en"])
def test_texts_never_recommend_actions_for_securities(lang):
    ampeln = all_sample_ampeln(lang)
    # sanity: the samples must actually cover all three statuses
    assert {a.status for a in ampeln} == {"green", "yellow", "red"}

    for result in ampeln:
        text = f"{result.title} {result.explanation} {result.lesson}"
        found = find_action_language(text, lang)
        assert found is None, (
            f"Ampel '{result.name}' ({result.status}, {lang}) enthält "
            f"Handlungsformulierung '{found}': {text[:200]}"
        )


@pytest.mark.parametrize("lang", ["de", "en"])
def test_lessons_are_static_and_ticker_free(lang):
    for result in all_sample_ampeln(lang):
        for ticker in SAMPLE_TICKERS:
            assert ticker.lower() not in result.lesson.lower(), (
                f"Lernkarte der Ampel '{result.name}' nennt Wertpapier "
                f"{ticker} — Lektionen müssen titel-frei bleiben."
            )
