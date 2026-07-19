"""AI layer tests: cascade fallback for every failure mode (mocked
provider, no real API calls), the SENTINEL_AI_ENABLED cost guard,
asymmetric adjustment with known inputs, news pipeline rules from §9,
and the principle-3 guardrail regression test with simulated LLM
answers containing action verbs.
"""

from types import SimpleNamespace

import pytest

from sentinel_core.ai import news
from sentinel_core.ai.guardrails import ACTION_VERB_STEMS, filter_llm_bullets
from sentinel_core.ai.llm_client import validate_market_context
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


# --- strict validation (§8) -----------------------------------------------------


def valid_payload(**overrides) -> dict:
    data = {
        "sentiment": -1,
        "confidence": 0.8,
        "bullets": ["Marktbreite nimmt ab", "Zinsdruck bleibt", "Vola erhöht"],
    }
    data.update(overrides)
    return data


def test_validation_accepts_valid_payload_and_cuts_bullets_to_five():
    context = validate_market_context(
        valid_payload(bullets=[f"b{i}" for i in range(7)])
    )

    assert context.sentiment == -1
    assert context.confidence == 0.8
    assert len(context.bullets) == 5  # more than 5 are cut (§8)


@pytest.mark.parametrize(
    "payload",
    [
        {"sentiment": -1},  # missing keys
        valid_payload(sentiment=5),
        valid_payload(sentiment="unklar"),
        valid_payload(confidence=1.5),
        valid_payload(bullets=["nur", "zwei"]),
    ],
)
def test_validation_rejects_broken_payloads_as_valueerror(payload):
    # Tool use guarantees a dict shape, NOT correct values — the model
    # stays untrusted and every field is re-checked (§8).
    with pytest.raises(ValueError):
        validate_market_context(payload)


# --- cascade fallback (§8) + SENTINEL_AI_ENABLED cost guard ---------------------


class FakeProvider:
    """Test double for the LLMProvider seam: counts calls, returns a
    fixed payload or raises — never talks to any network."""

    def __init__(self, payload: dict | None = None, exc: Exception | None = None):
        self.payload = payload
        self.exc = exc
        self.calls = 0

    def generate(self, prompt: str) -> dict:
        self.calls += 1
        if self.exc is not None:
            raise self.exc
        assert self.payload is not None
        return self.payload


def enable_ai(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SENTINEL_AI_ENABLED", "true")


def assert_neutral(result):
    assert result.available is False
    assert result.score_delta == 0
    assert result.sentiment == 0
    assert result.bullets == []
    assert "nicht verfügbar" in result.rationale
    assert result.unavailable_reason  # technical cause always recorded


def test_flag_off_blocks_before_any_provider_call(monkeypatch):
    # Cost guard: even with a key in the environment AND a working
    # provider at hand, nothing may be called without explicit opt-in.
    monkeypatch.delenv("SENTINEL_AI_ENABLED", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-vorhanden")
    provider = FakeProvider(valid_payload())

    result = assess_market(["Some headline"], provider=provider)

    assert_neutral(result)
    assert provider.calls == 0  # no call left the cascade
    assert "SENTINEL_AI_ENABLED" in result.unavailable_reason
    assert "ANTHROPIC" not in result.unavailable_reason


def test_flag_off_and_key_missing_show_same_user_text(monkeypatch):
    # Users see ONE friendly text for every unavailability cause; the
    # technical reasons stay distinguishable for debugging.
    monkeypatch.delenv("SENTINEL_AI_ENABLED", raising=False)
    flag_off = assess_market(["h"], provider=FakeProvider(valid_payload()))

    enable_ai(monkeypatch)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    key_missing = assess_market(["h"])  # real provider path, fails at key check

    assert flag_off.rationale == key_missing.rationale
    assert flag_off.unavailable_reason != key_missing.unavailable_reason
    assert "ANTHROPIC_API_KEY" in key_missing.unavailable_reason


def test_timeout_degrades_to_neutral(monkeypatch):
    enable_ai(monkeypatch)
    provider = FakeProvider(exc=TimeoutError("Zeitüberschreitung nach 30s"))

    result = assess_market(["Some headline"], provider=provider)

    assert_neutral(result)
    assert "Zeitüberschreitung" in result.unavailable_reason


def test_broken_payload_degrades_to_neutral(monkeypatch):
    enable_ai(monkeypatch)
    provider = FakeProvider(payload={"kaputt": 1})

    assert_neutral(assess_market(["Some headline"], provider=provider))


def test_happy_path_produces_available_assessment(monkeypatch):
    enable_ai(monkeypatch)
    provider = FakeProvider(valid_payload(sentiment=-2))

    result = assess_market(["Markets slide"], provider=provider)

    assert result.available is True
    assert result.sentiment == -2
    assert result.score_delta == round(8 * 0.8)
    assert len(result.bullets) == 3
    assert "Score-Anpassung" in result.rationale
    assert result.unavailable_reason is None
    assert provider.calls == 1


# --- principle-3 guardrail: LLM output is not trustworthy ------------------------


def test_llm_bullets_with_action_verbs_are_filtered(monkeypatch):
    # Simulated LLM answer that crosses the line in German and English —
    # the filter layer must catch it before it reaches the user.
    # exactly 5 bullets: validation cuts at 5 BEFORE the filter runs, so
    # all of these actually reach the guardrail
    enable_ai(monkeypatch)
    provider = FakeProvider(
        valid_payload(
            bullets=[
                "Sell NVDA now before earnings",
                "Verkaufe deine AAPL-Position und kaufe Gold",
                "Buy the dip in tech stocks",
                "Marktbreite nimmt weiter ab",
                "Zinssensitive Sektoren bleiben unter Druck",
            ]
        )
    )

    result = assess_market(["Some headline"], provider=provider)

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
