"""reports/* schemas — PDF risk-summary export.

Not (yet) part of API_CONTRACT.md; documented here directly. Mirrors the
PortfolioIn-only request shape of risk/analyze and risk/ampel, without a
`period` override — the report always uses one fixed 1-year window that
all its sections share (sentinel_api/routers/reports.py).
"""

from __future__ import annotations

from pydantic import BaseModel

from sentinel_api.schemas.common import PortfolioIn

__all__ = ["ReportRiskSummaryIn"]


class ReportRiskSummaryIn(BaseModel):
    portfolio: PortfolioIn
