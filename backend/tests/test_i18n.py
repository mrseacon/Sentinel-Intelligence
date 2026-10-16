"""Locale tests (I18N_DECISIONS.md §2): every generated text exists in German
and English, the two really differ, nothing is left unfilled or
untranslated, numbers follow the language's format, and principle 3 (no
action recommendation for securities) holds in BOTH languages.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from string import Formatter

import numpy as np
import pytest
from reportlab.platypus import Paragraph, Table

from sentinel_api.errors import error_code_for
from sentinel_api.reports.pdf import _stress_section, build_story
from sentinel_api.schemas.risk import AmpelOut, RiskAnalyzeOut
from sentinel_core.education import explanations
from sentinel_core.errors import SentinelError
from sentinel_core.i18n import SUPPORTED_LANGS, resolve_lang
from sentinel_core.i18n.catalog import TEXTS
from sentinel_core.i18n.format import day, num, pct
from sentinel_core.simulation.monte_carlo import simulate
from sentinel_core.stress import replay as stress
from test_ampel import all_sample_ampeln, find_action_language
from test_simulation import history
from test_stress import GFC_WINDOW, declining_series, fake_market

# German markers that must never appear in an English text: umlauts/eszett
# plus frequent function words and domain words. There is no exception
# list on purpose — every backend text, including preset titles, is
# translated; only ticker symbols pass through, and none contain these.
GERMAN_MARKERS = re.compile(
    r"[äöüÄÖÜß„“]|\b(?:und|der|die|das|nicht|dein|deines|deinem|ist|mit|"
    r"wäre|hätte|Depot|Jahr|Jahren|Zeitraum|Szenario|Gewicht\w*)\b"
)
PLACEHOLDER_LEFTOVER = re.compile(r"[{}]")


def placeholders(template: str) -> set[str]:
    return {name for _, name, _, _ in Formatter().parse(template) if name}


def assert_clean_pair(de: str, en: str) -> None:
    """The shared assertions for one text rendered in both languages."""
    assert de and en
    assert de != en, f"identical in de and en: {de[:120]}"
    for text in (de, en):
        assert not PLACEHOLDER_LEFTOVER.search(text), f"unfilled placeholder: {text}"
    marker = GERMAN_MARKERS.search(en)
    assert marker is None, f"German '{marker.group(0)}' in English text: {en}"
    # number format: German "42 %", English "42%"
    assert not re.search(r"\d%", de), f"German text without space before %: {de}"
    assert not re.search(r"\d %", en), f"English text with space before %: {en}"
    for lang, text in (("de", de), ("en", en)):
        found = find_action_language(text, lang)
        assert found is None, f"action wording '{found}' ({lang}): {text}"


# --- catalog structure ---------------------------------------------------------


def test_both_languages_have_identical_keys():
    assert set(TEXTS) == set(SUPPORTED_LANGS) == {"de", "en"}
    assert set(TEXTS["de"]) == set(TEXTS["en"])


@pytest.mark.parametrize("key", sorted(TEXTS["de"]))
def test_every_template_differs_and_shares_placeholders(key):
    de, en = TEXTS["de"][key], TEXTS["en"][key]
    assert de.strip() and en.strip()
    assert de != en, f"{key}: German and English identical"
    assert placeholders(de) == placeholders(en), f"{key}: placeholder mismatch"
    marker = GERMAN_MARKERS.search(en)
    assert marker is None, f"{key}: German '{marker.group(0)}' in English template"


@pytest.mark.parametrize("key", sorted(TEXTS["en"]))
def test_english_copy_has_no_long_dashes(key):
    # project copy style: natural English without em/en dashes
    assert "–" not in TEXTS["en"][key] and "—" not in TEXTS["en"][key]


# --- language validation ---------------------------------------------------


def test_resolve_lang_accepts_supported_languages():
    assert resolve_lang("de") == "de"
    assert resolve_lang("en") == "en"


@pytest.mark.parametrize("value", ["fr", "EN", "", "de-DE"])
def test_unknown_language_is_a_sentinel_error_with_own_code(value):
    with pytest.raises(SentinelError, match="Nicht unterstützte Sprache") as exc:
        resolve_lang(value)
    assert error_code_for(str(exc.value)) == "LANG_UNSUPPORTED"


# --- number formatting -----------------------------------------------------


def test_number_formats_follow_the_language():
    assert pct(0.42, "de") == "42 %"
    assert pct(0.42, "en") == "42%"
    assert pct(12.345, "de", 1) == "1.234,5 %"
    assert pct(12.345, "en", 1) == "1,234.5%"
    assert num(0.38, "de") == "0,38"
    assert num(0.38, "en") == "0.38"
    assert day(datetime(2007, 10, 9).date(), "de") == "09.10.2007"
    assert day(datetime(2007, 10, 9).date(), "en") == "10/09/2007"


# --- every explanation branch, rendered in both languages --------------------


def test_ampel_texts_differ_per_language_in_every_branch():
    de_ampeln = all_sample_ampeln("de")
    en_ampeln = all_sample_ampeln("en")
    assert len(de_ampeln) == len(en_ampeln)
    for de, en in zip(de_ampeln, en_ampeln, strict=True):
        assert (de.name, de.status, de.value) == (en.name, en.status, en.value)
        assert_clean_pair(de.title, en.title)
        assert_clean_pair(de.explanation, en.explanation)
        assert_clean_pair(de.lesson, en.lesson)


def test_ampel_english_numbers_use_decimal_point():
    concentration = all_sample_ampeln("en")[0]
    assert "50%" in concentration.explanation
    assert "0.38" in concentration.explanation  # HHI of 0.5/0.3/0.2


@pytest.mark.parametrize(
    ("total_return", "excluded"),
    [(-0.3, []), (0.1, []), (-0.3, ["YOUNG"])],
)
def test_stress_explanation_differs_per_language(total_return, excluded):
    args = dict(
        max_dd=-0.45, total_return=total_return, coverage=0.8, excluded=excluded
    )
    de = explanations.stress_explanation(
        title=explanations.stress_title("gfc_2008", "de"), lang="de", **args
    )
    en = explanations.stress_explanation(
        title=explanations.stress_title("gfc_2008", "en"), lang="en", **args
    )
    assert_clean_pair(de, en)
    if excluded:
        assert "YOUNG" in de and "YOUNG" in en


@pytest.mark.parametrize("preset_id", ["gfc_2008", "covid_2020", "rates_2022"])
def test_stress_static_texts_differ_per_language(preset_id):
    assert_clean_pair(
        explanations.stress_title(preset_id, "de"),
        explanations.stress_title(preset_id, "en"),
    )
    assert_clean_pair(
        explanations.stress_lesson(preset_id, "de"),
        explanations.stress_lesson(preset_id, "en"),
    )
    assert_clean_pair(
        explanations.stress_disclaimer("de"), explanations.stress_disclaimer("en")
    )


def test_stress_replay_returns_english_texts(monkeypatch, tmp_path):
    fake_market(monkeypatch, {"OLD1": declining_series(GFC_WINDOW), "YOUNG": None})
    weights = {"OLD1": 0.8, "YOUNG": 0.2}
    de = stress.replay(weights, "gfc_2008", cache_dir=tmp_path)
    en = stress.replay(weights, "gfc_2008", cache_dir=tmp_path, lang="en")

    # same numbers (the second call reads the CSV cache, hence approx),
    # only the texts change
    assert en.value_path == pytest.approx(de.value_path)
    assert en.max_drawdown == pytest.approx(de.max_drawdown)
    for field in ("title", "explanation", "lesson", "disclaimer"):
        assert_clean_pair(getattr(de, field), getattr(en, field))
    assert en.title == "Financial crisis 2008/09"
    assert stress.get_preset("covid_2020", "en").title == "Covid crash 2020"


@pytest.mark.parametrize(
    ("horizon", "days", "limited"),
    [(1, 800, False), (10, 600, True), (5, 300, False)],
)
def test_simulation_texts_differ_per_language(horizon, days, limited):
    returns = history(days, ["AAPL", "B"])
    if limited:
        returns.iloc[:300, returns.columns.get_loc("B")] = np.nan
    weights = {"AAPL": 0.5, "B": 0.5}
    de = simulate(weights, horizon, returns=returns)
    en = simulate(weights, horizon, returns=returns, lang="en")

    assert de.p50 == en.p50  # same fan, only the wording differs
    for field in ("explanation", "lesson", "disclaimer"):
        assert_clean_pair(getattr(de, field), getattr(en, field))
    if de.thin_history:
        assert "reused" in en.explanation
    if limited:
        assert "limited by B" in en.explanation
    if horizon == 1:
        assert "after 1 year " in en.explanation


@pytest.mark.parametrize(
    ("portfolio_vol", "portfolio_score"),
    [(0.20, 50.0), (0.30, 70.0), (0.10, 30.0)],
)
def test_benchmark_comparison_differs_per_language(portfolio_vol, portfolio_score):
    args = dict(
        benchmark_title="MSCI World (URTH)",
        portfolio_volatility=portfolio_vol,
        benchmark_volatility=0.20,
        portfolio_score=portfolio_score,
        benchmark_score=50.0,
    )
    de = explanations.benchmark_comparison_explanation(lang="de", **args)
    en = explanations.benchmark_comparison_explanation(lang="en", **args)
    assert_clean_pair(de, en)


def test_optimizer_disclaimer_differs_per_language():
    assert_clean_pair(
        TEXTS["de"]["optimize.disclaimer"], TEXTS["en"]["optimize.disclaimer"]
    )


# --- PDF report --------------------------------------------------------------


def _story_text(story: list) -> str:
    """All visible text of the report's flowables (paragraphs + tables)."""
    parts: list[str] = []
    for flowable in story:
        if isinstance(flowable, Paragraph):
            parts.append(flowable.getPlainText())
        elif isinstance(flowable, Table):
            for row in flowable._cellvalues:
                for cell in row:
                    parts.append(
                        cell.getPlainText()
                        if isinstance(cell, Paragraph)
                        else str(cell)
                    )
    return "\n".join(parts)


def _report_story(lang: str) -> str:
    analysis = RiskAnalyzeOut.model_validate(
        {
            "metrics": {
                "volatility": 0.21,
                "max_drawdown": -0.3,
                "var_95": -0.02,
                "cvar_95": -0.03,
                "hhi": 0.34,
                "diversification_ratio": 1.2,
            },
            "score": {
                "score": 48.0,
                "label": "Moderate",
                "components": {"volatility": 0.5},
                "drivers": [
                    {"factor": "volatility", "contribution": 0.2},
                    {"factor": "var_95", "contribution": 0.15},
                    {"factor": "concentration", "contribution": 0.1},
                ],
            },
            "risk_contribution": {"AAPL": 0.6, "MSFT": 0.4},
        }
    )
    ampeln = [
        {
            "id": a.name,
            "title": a.title,
            "status": a.status,
            "value": a.value,
            "explanation": a.explanation,
            "lesson": a.lesson,
        }
        for a in all_sample_ampeln(lang)[:3]
    ]
    story = build_story(
        weights={"AAPL": 60.0, "MSFT": 40.0},
        analysis=analysis,
        ampeln=[AmpelOut(**a) for a in ampeln],
        stress=None,
        generated_at=datetime(2026, 10, 16, 9, 30, tzinfo=UTC),
        lang=lang,
    )
    return _story_text(story)


def test_pdf_report_text_is_fully_localized():
    de = _report_story("de")
    en = _report_story("en")
    assert "Risiko-Report" in de and "Einstufung" in de and "Moderat" in de
    assert "Risk Report" in en and "Rating" in en and "Moderate" in en
    # raw factor ids never reach the paper, in either language
    for text in (de, en):
        assert "var_95" not in text and "volatility" not in text.split()
    assert "60,0 %" in de and "60.0%" in en
    assert "16.10.2026, 09:30 UTC" in de and "10/16/2026, 09:30 UTC" in en
    marker = GERMAN_MARKERS.search(en)
    assert marker is None, f"German '{marker.group(0)}' in English PDF text"
    assert find_action_language(en, "en") is None
    assert find_action_language(de, "de") is None


def test_pdf_stress_section_is_localized(monkeypatch, tmp_path):
    fake_market(monkeypatch, {"OLD1": declining_series(GFC_WINDOW)})
    result = stress.replay({"OLD1": 1.0}, "gfc_2008", cache_dir=tmp_path, lang="en")
    text = _story_text(_stress_section(result, "en"))
    assert "Scenario: Financial crisis 2008/09" in text
    assert "10/09/2007" in text
    assert GERMAN_MARKERS.search(text) is None
