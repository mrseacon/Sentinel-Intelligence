"""AI layer tests: cascade fallback for every failure mode (mocked LLM,
no real API calls), asymmetric adjustment with known inputs, news
pipeline rules from §9, and the principle-3 guardrail regression test
with simulated LLM answers containing action verbs.
"""

import json
from types import SimpleNamespace

import pytest

from sentinel_core.ai import news, risk_adjustment
from sentinel_core.ai.guardrails import ACTION_VERB_STEMS, filter_llm_bullets
from sentinel_core.ai.llm_client import parse_market_context
from sentinel_core.ai.risk_adjustment import (
    adjusted_score,
    assess_market,
    sentiment_delta,
)
from sentinel_core.constants import NEWS_MAX_HEADLINES

# --- asymmetric adjustment (§7) -----------------------------------------------


def test_delta_mapping_is_asymmetric_at_full_confidence():
    assert sentiment_delta(2, 1.0) == -6
    assert sentiment_delta(1, 1.0) == -3
    assert sentiment_delta(0, 1.0) == 0
    assert sentiment_delta(-1, 1.0) == 4
    assert sentiment_delta(-2, 1.0) == 8
    # negative news must weigh more than positive (conservative principle)
    assert abs(sentiment_delta(-2, 1.0)) > abs(sentiment_delta(2, 1.0))
    assert abs(sentiment_delta(-1, 1.0)) > abs(sentiment_delta(1, 1.0))


def test_delta_is_scaled_by_confidence_and_rounded_to_int():
    assert sentiment_delta(-1, 0.5) == 2  # 4 * 0.5
    assert sentiment_delta(-2, 0.25) == 2  # 8 * 0.25
    assert sentiment_delta(2, 0.4) == pytest.approx(-2)  # round(-2.4)
    assert sentiment_delta(-2, 0.0) == 0  # no confidence, no influence
    assert isinstance(sentiment_delta(-1, 0.5), int)


def test_delta_validates_inputs_in_german():
    with pytest.raises(ValueError, match="Sentiment muss"):
        sentiment_delta(3, 1.0)
    with pytest.raises(ValueError, match="Confidence muss"):
        sentiment_delta(1, 1.5)


def test_adjusted_score_is_clamped_to_0_100():
    assert adjusted_score(98.0, 8) == 100.0
    assert adjusted_score(2.0, -6) == 0.0
    assert adjusted_score(50.0, 4) == 54.0


# --- strict parsing (§8) --------------------------------------------------------


def valid_answer(**overrides) -> str:
    data = {
        "sentiment": -1,
        "confidence": 0.8,
        "bullets": ["Marktbreite nimmt ab", "Zinsdruck bleibt", "Vola erhöht"],
    }
    data.update(overrides)
    return json.dumps(data)


def test_parse_accepts_valid_answer_and_cuts_bullets_to_five():
    context = parse_market_context(valid_answer(bullets=[f"b{i}" for i in range(7)]))

    assert context.sentiment == -1
    assert context.confidence == 0.8
    assert len(context.bullets) == 5  # more than 5 are cut (§8)


@pytest.mark.parametrize(
    "raw",
    [
        "keine json antwort",
        json.dumps({"sentiment": -1}),  # missing keys
        valid_answer(sentiment=5),
        valid_answer(confidence=1.5),
        valid_answer(bullets=["nur", "zwei"]),
    ],
)
def test_parse_rejects_broken_answers_as_valueerror(raw):
    with pytest.raises(ValueError):
        parse_market_context(raw)


# --- cascade fallback (§8): every failure yields a neutral result ---------------


def assert_neutral(result):
    assert result.available is False
    assert result.score_delta == 0
    assert result.sentiment == 0
    assert result.bullets == []
    assert "nicht verfügbar" in result.rationale


def test_missing_api_key_degrades_to_neutral(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = assess_market(["Some headline"])

    assert_neutral(result)
    assert "OPENAI_API_KEY" in result.rationale


def test_timeout_degrades_to_neutral(monkeypatch):
    def timing_out(prompt):
        raise TimeoutError("Zeitüberschreitung nach 30s")

    monkeypatch.setattr(risk_adjustment, "generate", timing_out)

    assert_neutral(assess_market(["Some headline"]))


def test_unparseable_answer_degrades_to_neutral(monkeypatch):
    monkeypatch.setattr(risk_adjustment, "generate", lambda prompt: "kaputt {")

    assert_neutral(assess_market(["Some headline"]))


def test_happy_path_produces_available_assessment(monkeypatch):
    monkeypatch.setattr(
        risk_adjustment, "generate", lambda prompt: valid_answer(sentiment=-2)
    )

    result = assess_market(["Markets slide"])

    assert result.available is True
    assert result.sentiment == -2
    assert result.score_delta == round(8 * 0.8)
    assert len(result.bullets) == 3
    assert "Score-Anpassung" in result.rationale


# --- principle-3 guardrail: LLM output is not trustworthy ------------------------


def test_llm_bullets_with_action_verbs_are_filtered(monkeypatch):
    # Simulated LLM answer that crosses the line in German and English —
    # the filter layer must catch it before it reaches the user.
    # exactly 5 bullets: parsing cuts at 5 BEFORE the filter runs, so all
    # of these actually reach the guardrail
    tainted = valid_answer(
        bullets=[
            "Sell NVDA now before earnings",
            "Verkaufe deine AAPL-Position und kaufe Gold",
            "Buy the dip in tech stocks",
            "Marktbreite nimmt weiter ab",
            "Zinssensitive Sektoren bleiben unter Druck",
        ]
    )
    monkeypatch.setattr(risk_adjustment, "generate", lambda prompt: tainted)

    result = assess_market(["Some headline"])

    assert result.available is True
    assert len(result.bullets) == 2  # only the descriptive ones survive
    for text in [*result.bullets, result.rationale]:
        for stem in ACTION_VERB_STEMS:
            assert (
                stem not in text.lower()
            ), f"LLM-Text mit Handlungsverb '{stem}' durchgereicht: {text}"


def test_filter_overblocks_by_design():
    # substring semantics: "sell-off" contains "sell" and is dropped —
    # accepted trade-off, documented in guardrails.py
    kept = filter_llm_bullets(["Markets extended the sell-off", "Vola steigt"])

    assert kept == ["Vola steigt"]


# --- news pipeline (§9) ----------------------------------------------------------


def rss(*titles: str) -> bytes:
    items = "".join(f"<item><title>{t}</title></item>" for t in titles)
    return f"<rss><channel>{items}</channel></rss>".encode()


def patch_feeds(monkeypatch, feeds: dict[str, bytes | Exception]):
    """Map a query substring to RSS bytes or an exception; also silence
    the throttle sleep and record fetched URLs."""
    urls: list[str] = []
    sleeps: list[float] = []
    monkeypatch.setattr(news.time, "sleep", sleeps.append)

    def fake_get(url, headers=None, timeout=None):
        assert "User-Agent" in headers  # required, Google blocks without (§9)
        urls.append(url)
        for key, payload in feeds.items():
            if key.replace(" ", "%20") in url or key in url:
                if isinstance(payload, Exception):
                    raise payload
                return SimpleNamespace(content=payload, raise_for_status=lambda: None)
        return SimpleNamespace(content=rss(), raise_for_status=lambda: None)

    monkeypatch.setattr(news.requests, "get", fake_get)
    return urls, sleeps


def test_title_split_keeps_dashes_inside_headline(monkeypatch):
    patch_feeds(
        monkeypatch,
        {"stock%20market%20risk": rss("Fed hikes - markets tumble - Reuters")},
    )

    headlines = news.fetch_headlines([])

    assert headlines[0].title == "Fed hikes - markets tumble"
    assert headlines[0].source == "Reuters"


def test_title_without_source_falls_back_to_google_news(monkeypatch):
    patch_feeds(monkeypatch, {"stock%20market%20risk": rss("Plain headline")})

    headlines = news.fetch_headlines([])

    assert headlines[0].source == "Google News"


def test_duplicate_titles_are_deduped_case_insensitively(monkeypatch):
    patch_feeds(
        monkeypatch,
        {
            "stock%20market%20risk": rss("Same Story - A"),
            "inflation": rss("SAME STORY - B"),
        },
    )

    headlines = news.fetch_headlines([])

    assert [h.title.lower() for h in headlines].count("same story") == 1


def test_macro_queries_run_first_then_tickers_with_limit(monkeypatch):
    ticker_titles = [f"NVDA item {i} - X" for i in range(6)]
    urls, sleeps = patch_feeds(monkeypatch, {"NVDA": rss(*ticker_titles)})

    headlines = news.fetch_headlines(["NVDA"])

    assert len(urls) == 4  # 3 macro + 1 ticker query
    assert "NVDA" in urls[-1]  # ticker query comes last
    nvda = [h for h in headlines if h.bucket == "company"]
    assert len(nvda) == 4  # NEWS_LIMIT_PER_TICKER
    assert len(sleeps) == 3  # throttled between requests, not before the first


def test_hard_cap_at_25_headlines(monkeypatch):
    many = [f"Story {i} - Src" for i in range(40)]
    patch_feeds(monkeypatch, {"stock%20market%20risk": rss(*many)})

    headlines = news.fetch_headlines([])

    assert len(headlines) == NEWS_MAX_HEADLINES


def test_unreachable_feed_is_a_warning_not_an_error(monkeypatch):
    patch_feeds(
        monkeypatch,
        {
            "stock%20market%20risk": ConnectionError("Feed nicht erreichbar"),
            "inflation": rss("Inflation cools - Reuters"),
        },
    )

    headlines = news.fetch_headlines([])  # must not raise

    assert [h.title for h in headlines] == ["Inflation cools"]


def test_bucket_classifier_uses_uppercase_ticker(monkeypatch):
    patch_feeds(
        monkeypatch,
        {
            "stock%20market%20risk": rss(
                "NVDA beats estimates - CNBC", "Fed pauses - WSJ"
            )
        },
    )

    headlines = news.fetch_headlines(["NVDA"])

    buckets = {h.title: h.bucket for h in headlines}
    assert buckets["NVDA beats estimates"] == "company"
    assert buckets["Fed pauses"] == "macro"
