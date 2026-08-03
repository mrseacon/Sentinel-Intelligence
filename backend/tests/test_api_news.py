"""Integration tests for the news/* router: free headline lookup, no
LLM/AI gate (SENTINEL_AI_ENABLED must not matter here). RSS is mocked
like everywhere else in the suite (test_ai.patch_feeds).
"""

from fastapi.testclient import TestClient

from sentinel_api.main import app
from test_ai import patch_feeds, rss

client = TestClient(app)


def test_headlines_happy_path_fetches_only_the_ticker_query(monkeypatch):
    # Regression guard for the macro-cap issue (ai/news.py
    # fetch_ticker_headlines docstring): this endpoint must NEVER fire
    # the macro queries, or real (~100-item) Google feeds would starve
    # out the ticker query before it's ever reached.
    urls, _ = patch_feeds(
        monkeypatch,
        {
            "NVDA": rss(
                "NVDA beats estimates - CNBC",
                links=["https://example.com/nvda"],
                pub_dates=["Sun, 02 Aug 2026 12:00:00 GMT"],
            )
        },
    )

    response = client.get("/news/headlines", params={"ticker": "NVDA"})

    assert response.status_code == 200
    assert len(urls) == 1  # no macro queries fired
    body = response.json()
    assert body["ticker"] == "NVDA"
    assert len(body["headlines"]) == 1
    headline = body["headlines"][0]
    assert headline["title"] == "NVDA beats estimates"
    assert headline["source"] == "CNBC"
    assert headline["link"] == "https://example.com/nvda"
    assert headline["published"] is not None


def test_headlines_are_facts_only_no_sentiment_or_score_fields(monkeypatch):
    patch_feeds(monkeypatch, {"NVDA": rss("NVDA beats estimates - CNBC")})

    response = client.get("/news/headlines", params={"ticker": "NVDA"})

    assert response.status_code == 200
    headline = response.json()["headlines"][0]
    assert set(headline) == {"title", "source", "link", "published"}


def test_headlines_unreachable_feed_returns_empty_list_not_error(monkeypatch):
    patch_feeds(monkeypatch, {"NVDA": ConnectionError("Feed nicht erreichbar")})

    response = client.get("/news/headlines", params={"ticker": "NVDA"})

    assert response.status_code == 200
    assert response.json()["headlines"] == []


def test_headlines_available_regardless_of_ai_flag(monkeypatch):
    monkeypatch.delenv("SENTINEL_AI_ENABLED", raising=False)
    patch_feeds(monkeypatch, {"NVDA": rss("NVDA beats estimates - CNBC")})

    response = client.get("/news/headlines", params={"ticker": "NVDA"})

    assert response.status_code == 200
    assert len(response.json()["headlines"]) == 1


def test_headlines_invalid_ticker_gives_contract_error(monkeypatch):
    response = client.get("/news/headlines", params={"ticker": "../etc/passwd"})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "TICKER_INVALID"
