"""paper/* routes (API_CONTRACT.md §2.7–§2.9).

REFERENCE PATTERN for all future routers:
- a route calls exactly ONE sentinel_core function and returns its
  result — any computation here would be an architecture violation
  (CLAUDE.md rule 1),
- no try/except: domain ValueErrors bubble up to the global handlers
  in errors.py, which produce the {detail, code} contract shape,
- response models are the re-exported core models from schemas/.
"""

from __future__ import annotations

from fastapi import APIRouter

from sentinel_api.schemas.paper import (
    AccountValuationOut,
    PaperExecuteIn,
    PaperQuoteIn,
    PaperValuationIn,
    QuoteOut,
    TransactionIO,
)
from sentinel_core.paper.engine import execute, quote
from sentinel_core.paper.valuation import value_account

router = APIRouter(prefix="/paper", tags=["paper"])


@router.post("/quote", response_model=QuoteOut)
def post_quote(body: PaperQuoteIn) -> QuoteOut:
    return quote(body.ticker, body.quantity, body.side)


@router.post("/execute", response_model=TransactionIO)
def post_execute(body: PaperExecuteIn) -> TransactionIO:
    return execute(
        body.account, body.transactions, body.ticker, body.side, body.quantity
    )


@router.post("/valuation", response_model=AccountValuationOut)
def post_valuation(body: PaperValuationIn) -> AccountValuationOut:
    return value_account(body.account, body.transactions)
