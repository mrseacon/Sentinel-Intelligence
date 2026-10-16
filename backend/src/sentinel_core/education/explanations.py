"""Explanation texts and lessons (ARCHITECTURE.md §5), German and English.

All texts are static templates with interpolated numbers — no LLM in the
core path (principle 2, graceful degradation). Wording is strictly
descriptive: NEVER an action recommendation for a specific security
(principle 3 — legally relevant for operation from Germany). Imperatives
are allowed only about concepts, never about securities. Regression
tests (test_ampel.py, test_i18n.py) enforce this for BOTH languages —
keep it in mind for every edit here and in sentinel_core/i18n/catalog.py.

This module holds the branching logic (status, optional clauses, plural)
exactly once; the wording per language lives in the i18n catalog.

Lessons are general concept cards: static, identical for every status,
and free of any ticker names.
"""

from __future__ import annotations

from typing import Literal

import pandas as pd

from sentinel_core.constants import (
    BENCHMARK_SCORE_SIMILAR_BAND,
    BENCHMARK_VOL_SIMILAR_BAND,
    STRESS_PRESETS,
)
from sentinel_core.i18n import DEFAULT_LANG, Lang
from sentinel_core.i18n.catalog import TEXTS, t
from sentinel_core.i18n.format import num, pct

AmpelStatus = Literal["green", "yellow", "red"]


def ampel_title(ampel_id: str, lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, f"ampel.title.{ampel_id}")


def ampel_lesson(ampel_id: str, lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, f"ampel.lesson.{ampel_id}")


def stress_title(preset_id: str, lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, f"stress.title.{preset_id}")


def stress_lesson(preset_id: str, lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, f"stress.lesson.{preset_id}")


def stress_disclaimer(lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, "stress.disclaimer")


def simulation_lesson(lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, "simulation.lesson")


def simulation_disclaimer(lang: Lang = DEFAULT_LANG) -> str:
    return t(lang, "simulation.disclaimer")


# German constants kept for existing imports (tests, callers without lang).
LESSON_CONCENTRATION = TEXTS["de"]["ampel.lesson.concentration"]
LESSON_DIVERSIFICATION = TEXTS["de"]["ampel.lesson.diversification"]
LESSON_VOLATILITY = TEXTS["de"]["ampel.lesson.volatility"]
STRESS_LESSONS = {pid: stress_lesson(pid) for pid in STRESS_PRESETS}
STRESS_DISCLAIMER = stress_disclaimer()
SIM_LESSON = simulation_lesson()
SIM_DISCLAIMER = simulation_disclaimer()


# --- stress test replay (STRESS_TEST_DECISIONS.md) ---------------------------


def stress_explanation(
    title: str,
    max_dd: float,
    total_return: float,
    coverage: float,
    excluded: list[str],
    lang: Lang = DEFAULT_LANG,
) -> str:
    """Depot-specific replay text: past tense, descriptive, with numbers."""
    direction = (
        "stress.direction_lost" if total_return < 0 else "stress.direction_gained"
    )
    text = t(
        lang,
        "stress.explanation",
        title=title,
        drawdown=pct(abs(max_dd), lang),
        total_return=pct(abs(total_return), lang),
        direction=t(lang, direction),
    )
    if excluded:
        text += t(
            lang,
            "stress.excluded_clause",
            coverage=pct(coverage, lang),
            tickers=", ".join(excluded),
        )
    return text


# --- Monte Carlo simulation (MONTE_CARLO_DECISIONS.md) -----------------------
# Frequency wording instead of probability language, subjunctive, median
# never labeled "expected" — the fan must not read as a forecast.


def simulation_explanation(
    horizon_years: int,
    final_p10: float,
    final_p50: float,
    final_p90: float,
    history_years: float,
    limiting_ticker: str | None,
    recycling_factor: float,
    thin_history: bool,
    lang: Lang = DEFAULT_LANG,
) -> str:
    """Frequency-worded fan summary with mandatory data-basis transparency."""
    year_key = (
        "simulation.year_singular" if horizon_years == 1 else "simulation.year_plural"
    )
    limit_clause = (
        t(lang, "simulation.limit_clause", ticker=limiting_ticker)
        if limiting_ticker
        else ""
    )
    text = t(
        lang,
        "simulation.explanation",
        horizon=str(horizon_years),
        year_word=t(lang, year_key),
        p10=num(final_p10, lang),
        p50=num(final_p50, lang),
        p90=num(final_p90, lang),
        history_years=num(history_years, lang, 1),
        limit_clause=limit_clause,
    )
    if thin_history:
        text += t(
            lang, "simulation.thin_history", recycling=num(recycling_factor, lang, 1)
        )
    return text


# --- Risk-Ampel ---------------------------------------------------------------


def concentration_explanation(
    status: AmpelStatus,
    hhi: float,
    weights: pd.Series,
    lang: Lang = DEFAULT_LANG,
) -> str:
    """Depot-specific text naming the concrete trigger (top position)."""
    values = {
        "ticker": str(weights.idxmax()),
        "share": pct(float(weights.max()), lang),
        "hhi": num(hhi, lang),
    }
    if status != "red":
        return t(lang, f"concentration.{status}", **values)
    top3_clause = ""
    if len(weights) > 3:
        top3_share = float(weights.nlargest(3).sum())
        top3_clause = t(
            lang, "concentration.top3_clause", top3_share=pct(top3_share, lang)
        )
    return t(lang, "concentration.red", top3_clause=top3_clause, **values)


def diversification_explanation(
    status: AmpelStatus,
    ratio: float,
    n_positions: int,
    lang: Lang = DEFAULT_LANG,
) -> str:
    if status == "red" and n_positions == 1:
        return t(lang, "diversification.red_single")
    position_key = (
        "diversification.position_singular"
        if n_positions == 1
        else "diversification.position_plural"
    )
    return t(
        lang,
        f"diversification.{status}",
        n=str(n_positions),
        ratio=num(ratio, lang),
        position_word=t(lang, position_key),
    )


def volatility_explanation(
    status: AmpelStatus, annualized_vol: float, lang: Lang = DEFAULT_LANG
) -> str:
    return t(lang, f"volatility.{status}", vol=pct(annualized_vol, lang))


# --- benchmark comparison (risk/benchmark-compare) ---------------------------
# Deliberately compares only volatility and score, not diversification_ratio
# or HHI: for a single-ticker benchmark those are always trivially 1.0/None,
# so any multi-asset portfolio would always look "more diversified" by
# construction, not because of a real insight — that would be a misleading
# comparison, not a description (principle 3 also governs what NOT to say).


def benchmark_comparison_explanation(
    benchmark_title: str,
    portfolio_volatility: float,
    benchmark_volatility: float,
    portfolio_score: float,
    benchmark_score: float,
    lang: Lang = DEFAULT_LANG,
) -> str:
    """Depot-specific comparison text: descriptive, never a recommendation,
    ticker-free (only the benchmark's own name is mentioned, never a
    position from the portfolio)."""
    vol_diff = portfolio_volatility - benchmark_volatility
    if abs(vol_diff) < BENCHMARK_VOL_SIMILAR_BAND:
        vol_key = "benchmark.vol_similar"
    elif vol_diff > 0:
        vol_key = "benchmark.vol_higher"
    else:
        vol_key = "benchmark.vol_lower"

    score_diff = portfolio_score - benchmark_score
    if abs(score_diff) < BENCHMARK_SCORE_SIMILAR_BAND:
        score_clause = t(lang, "benchmark.score_similar")
    else:
        score_key = (
            "benchmark.score_higher" if score_diff > 0 else "benchmark.score_lower"
        )
        score_clause = t(
            lang,
            score_key,
            points=str(round(abs(score_diff))),
            title=benchmark_title,
        )

    return t(
        lang,
        "benchmark.comparison",
        vol_clause=t(lang, vol_key, title=benchmark_title),
        portfolio_vol=pct(portfolio_volatility, lang),
        benchmark_vol=pct(benchmark_volatility, lang),
        score_clause=score_clause,
    )
