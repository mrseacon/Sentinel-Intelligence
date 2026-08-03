"""Google News RSS pipeline (KNOWLEDGE_EXTRACTION.md §9).

Deliberately key-less and free. All the small rules here were hard-won
in the legacy project: custom User-Agent (Google throttles default
Python agents), rsplit on " - " from the right (headlines may contain
dashes), lowercase dedupe, macro before company queries, polite
throttling. Fetch failures are warnings, not errors — news are an
optional enrichment, the core must work without them (principle 2).
"""

from __future__ import annotations

import time
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import requests
from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import (
    NEWS_LIMIT_PER_TICKER,
    NEWS_MACRO_QUERIES,
    NEWS_MAX_HEADLINES,
    NEWS_THROTTLE_SECONDS,
)

# Google throttles/blocks default Python user agents (§9).
_HEADERS = {"User-Agent": "Mozilla/5.0 (Sentinel education app)"}
_TIMEOUT_SECONDS = 10.0
# hl/gl/ceid force the English US edition — the LLM prompt expects it.
_FEED_URL = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"


class Headline(BaseModel):
    """One deduplicated headline with its source and rough bucket."""

    model_config = ConfigDict(frozen=True)

    title: str
    source: str
    link: str
    published: datetime | None  # None if the feed omitted/malformed pubDate
    bucket: str  # "macro" | "company"


def classify_headline_bucket(title: str, tickers: list[str]) -> str:
    """Primitive substring classifier (§9): ticker symbol in the
    (uppercase) title -> company, else macro. Known false positives for
    short tickers are accepted — this only drives UI filtering."""
    if any(ticker.upper() in title for ticker in tickers):
        return "company"
    return "macro"


def fetch_headlines(tickers: list[str]) -> list[Headline]:
    """Fetch, dedupe and cap headlines: macro queries first, then per
    ticker (limit NEWS_LIMIT_PER_TICKER each), hard cap NEWS_MAX_HEADLINES.

    Never raises: unreachable feeds simply contribute nothing.
    """
    headlines: list[Headline] = []
    seen_titles: set[str] = set()

    queries = [(query, NEWS_MAX_HEADLINES) for query in NEWS_MACRO_QUERIES]
    queries += [(f'"{ticker}" stock', NEWS_LIMIT_PER_TICKER) for ticker in tickers]

    for index, (query, limit) in enumerate(queries):
        if len(headlines) >= NEWS_MAX_HEADLINES:
            break
        if index > 0:
            time.sleep(NEWS_THROTTLE_SECONDS)  # polite throttling (§9)
        taken = 0
        for raw_item in _fetch_feed(query):
            if taken >= limit or len(headlines) >= NEWS_MAX_HEADLINES:
                break
            title, source = _split_title(raw_item["title"])
            # dedupe by lowercase title: the same story arrives via
            # several queries (§9)
            if not title or title.lower() in seen_titles:
                continue
            seen_titles.add(title.lower())
            headlines.append(
                Headline(
                    title=title,
                    source=source,
                    link=raw_item["link"],
                    published=_parse_pub_date(raw_item["pub_date"]),
                    bucket=classify_headline_bucket(title, tickers),
                )
            )
            taken += 1
    return headlines


def fetch_ticker_headlines(ticker: str) -> list[Headline]:
    """Company headlines for ONE ticker, no macro queries.

    Deliberately separate from fetch_headlines(), not a thin wrapper
    around it: that function fires the fixed macro-first query order
    (§9) with EACH macro query capped at NEWS_MAX_HEADLINES (25), and
    real Google feeds return ~100 items per query — so on live data the
    very first macro query alone fills the global cap and the ticker
    query is never reached (discovered while building
    GET /news/headlines, which needs real per-ticker results). This
    function only ever fires the single ticker query, so it always
    returns ticker news regardless of that cap. fetch_headlines() stays
    untouched for the (unwired) AI sentiment pipeline, which relies on
    its macro-first mix and cap.

    Never raises: an unreachable feed simply yields [] (§9/§14).
    """
    headlines: list[Headline] = []
    seen_titles: set[str] = set()

    for raw_item in _fetch_feed(f'"{ticker}" stock'):
        if len(headlines) >= NEWS_LIMIT_PER_TICKER:
            break
        title, source = _split_title(raw_item["title"])
        # dedupe by lowercase title: the same story can appear twice
        # in one feed (§9)
        if not title or title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())
        headlines.append(
            Headline(
                title=title,
                source=source,
                link=raw_item["link"],
                published=_parse_pub_date(raw_item["pub_date"]),
                # No macro query mixed in here — every result IS
                # ticker-specific by construction.
                bucket="company",
            )
        )
    return headlines


def _fetch_feed(query: str) -> list[dict[str, str]]:
    """Raw title/link/pubDate of one RSS query; any failure yields []
    (warning-level semantics: news must never break the caller, §9/§14)."""
    url = _FEED_URL.format(query=quote(query))
    try:
        response = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT_SECONDS)
        response.raise_for_status()
        root = ET.fromstring(response.content)
    except Exception:  # noqa: BLE001 — deliberate: news are optional
        return []
    return [
        {
            "title": item.findtext("title") or "",
            "link": item.findtext("link") or "",
            "pub_date": item.findtext("pubDate") or "",
        }
        for item in root.iter("item")
    ]


def _parse_pub_date(raw: str) -> datetime | None:
    """Google's pubDate is RFC 822. Missing/malformed dates degrade to
    None rather than raising (§9: news must never break the caller)."""
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return None


def _split_title(raw_title: str) -> tuple[str, str]:
    """Google titles are "Headline - Source". rsplit from the RIGHT —
    the headline itself may contain " - " (§9). No match -> source
    "Google News"."""
    if " - " in raw_title:
        headline, source = raw_title.rsplit(" - ", 1)
        return headline.strip(), source.strip()
    return raw_title.strip(), "Google News"
