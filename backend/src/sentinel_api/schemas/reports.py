"""reports/* schemas — PDF risk-summary export.

Documented in API_CONTRACT.md §2.16. Mirrors the
PortfolioIn-only request shape of risk/analyze and risk/ampel, without a
`period` override — the report always uses one fixed 1-year window that
all its sections share (sentinel_api/routers/reports.py).
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from sentinel_api.schemas.common import LANG_DESCRIPTION, PortfolioIn

__all__ = ["ReportRiskSummaryIn"]


class ReportRiskSummaryIn(BaseModel):
    portfolio: PortfolioIn
    lang: str = Field(default="de", description=LANG_DESCRIPTION)
