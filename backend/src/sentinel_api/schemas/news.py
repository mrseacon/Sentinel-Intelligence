"""news/* schemas — free, LLM-independent headline lookup.

Not (yet) part of API_CONTRACT.md; documented here directly.
NewsHeadlineOut mirrors sentinel_core.ai.news.Headline minus `bucket`:
the router already filters to bucket == "company" for the requested
ticker (§ router docstring), so a per-item bucket field would always
read "company" and carry no information.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

__all__ = ["NewsHeadlineOut", "NewsHeadlinesOut"]


class NewsHeadlineOut(BaseModel):
    title: str
    source: str
    link: str
    published: datetime | None  # None if the feed omitted/malformed pubDate


class NewsHeadlinesOut(BaseModel):
    ticker: str
    headlines: list[NewsHeadlineOut]
