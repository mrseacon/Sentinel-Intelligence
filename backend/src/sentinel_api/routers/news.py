"""news/* routes — free, LLM-independent headline lookup.

Deliberately outside every AI/cost gate: this endpoint calls ONLY
sentinel_core.ai.news.fetch_ticker_headlines (a plain RSS fetch, no API
key, no LLM call) — it never touches risk_adjustment.py or
llm_client.py, so it works regardless of SENTINEL_AI_ENABLED. There is
no paid call to gate here (ARCHITECTURE principle 2: graceful
degradation / always-on free features).

Uses fetch_ticker_headlines, NOT fetch_headlines: the latter's macro-
first query order gets starved out by real Google feeds before the
ticker query is ever reached (see fetch_ticker_headlines' docstring in
ai/news.py). fetch_ticker_headlines fires only the ticker query, so
every result is already ticker-specific — no bucket filtering needed
here.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from sentinel_api.schemas.news import NewsHeadlineOut, NewsHeadlinesOut
from sentinel_core.ai.news import fetch_ticker_headlines
from sentinel_core.data.loader import validate_ticker

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/headlines", response_model=NewsHeadlinesOut)
def get_news_headlines(
    ticker: str = Query(..., min_length=1, max_length=15),
) -> NewsHeadlinesOut:
    normalized = validate_ticker(ticker.strip().upper())
    headlines = fetch_ticker_headlines(normalized)
    return NewsHeadlinesOut(
        ticker=normalized,
        headlines=[
            NewsHeadlineOut(
                title=h.title,
                source=h.source,
                link=h.link,
                published=h.published,
            )
            for h in headlines
        ],
    )
