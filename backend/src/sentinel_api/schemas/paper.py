"""paper/* schemas (API_CONTRACT.md §2.7–§2.9).

REFERENCE PATTERN: core result models that the contract marks as "1:1"
are re-exported, not redefined — the contract and the core model are
the same object, so they cannot drift apart. Only request envelopes are
defined here. Deliberately NO domain constraints (e.g. quantity > 0) on
request fields where core validates them itself: bounds are domain
logic, and core produces the German error the contract expects.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from sentinel_api.limits import MAX_TRANSACTIONS
from sentinel_core.data.loader import validate_ticker
from sentinel_core.paper.engine import Quote as QuoteOut
from sentinel_core.paper.ledger import (
    PaperAccount as PaperAccountIn,
)
from sentinel_core.paper.ledger import (
    Side,
)
from sentinel_core.paper.ledger import (
    Transaction as TransactionIO,
)
from sentinel_core.paper.valuation import (
    AccountValuation as AccountValuationOut,
)

__all__ = [
    "AccountValuationOut",
    "PaperAccountIn",
    "PaperExecuteIn",
    "PaperQuoteIn",
    "PaperValuationIn",
    "QuoteOut",
    "TransactionIO",
]


class PaperQuoteIn(BaseModel):
    """Stateless preview: no account needed, the client adds cash_delta
    to its own cash for the "Cash danach" display (contract §2.7)."""

    ticker: str
    side: Side
    quantity: int

    # Normalize + allowlist-validate before anything reaches a Yahoo URL
    # (security audit F5). Transaction tickers inside the history need no
    # schema validator: they only go outbound through the loader, which
    # validates every ticker at the boundary.
    @field_validator("ticker")
    @classmethod
    def _normalize_ticker(cls, value: str) -> str:
        return validate_ticker(str(value).strip().upper())


class PaperExecuteIn(BaseModel):
    """Phase 1 stateless (§6): the full client-held history comes along;
    the response is ONLY the new transaction, appended client-side."""

    account: PaperAccountIn
    transactions: list[TransactionIO] = Field(max_length=MAX_TRANSACTIONS)
    ticker: str
    side: Side
    quantity: int

    @field_validator("ticker")
    @classmethod
    def _normalize_ticker(cls, value: str) -> str:
        return validate_ticker(str(value).strip().upper())


class PaperValuationIn(BaseModel):
    account: PaperAccountIn
    transactions: list[TransactionIO] = Field(max_length=MAX_TRANSACTIONS)
