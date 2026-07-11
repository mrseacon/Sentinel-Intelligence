"""Global {detail, code} error mapping (API_CONTRACT.md §1.1).

REFERENCE PATTERN for every router: routes never catch domain errors
themselves. sentinel_core raises German, user-ready ValueErrors; the
handlers here turn them into the contract shape — the `detail` text is
passed through UNCHANGED, the stable `code` comes from the ordered
fragment registry below.

The registry is the documented v1 bridge (API_CONTRACT §1.1): whoever
rewords a core error message must check this table. Target solution,
once it itches: a SentinelError base class in core carrying its own
code — the existing message tests stay valid through that refactor.
"""

from __future__ import annotations

import requests
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Ordered: more specific fragments FIRST (e.g. "Verkaufserlös deckt"
# must win over "Verkauf von"). Matching is case-sensitive substring —
# some contract entries sit mid-sentence, and case sensitivity keeps
# "Kauf von" from matching inside "Verkauf von".
ERROR_CODE_REGISTRY: tuple[tuple[str, str], ...] = (
    ("Verkaufserlös deckt", "PAPER_FEE_NOT_COVERED"),
    ("Verkauf von", "PAPER_INSUFFICIENT_HOLDINGS"),
    ("Kauf von", "PAPER_INSUFFICIENT_CASH"),
    ("Menge muss", "PAPER_INVALID_QUANTITY"),
    ("Inkonsistente Transaktionshistorie", "LEDGER_INCONSISTENT"),
    ("Keine Kursdaten", "TICKER_NOT_FOUND"),
    ("Keine Renditedaten", "TICKER_NOT_FOUND"),
    ("Keine Ticker angegeben", "PORTFOLIO_INVALID"),
    ("Keine Gewichte", "PORTFOLIO_INVALID"),
    ("Negative Gewichte", "PORTFOLIO_INVALID"),
    ("Summe der Gewichte", "PORTFOLIO_INVALID"),
    ("Unbekanntes Krisen-Szenario", "STRESS_UNKNOWN_PRESET"),
    ("nicht aussagekräftig", "STRESS_INSUFFICIENT_COVERAGE"),
    ("Zeithorizont muss", "SIM_HORIZON_INVALID"),
    ("Zu wenig Kurshistorie", "SIM_INSUFFICIENT_HISTORY"),
    ("nicht konvergiert", "OPTIMIZER_NO_CONVERGENCE"),
    ("enthalten Lücken", "OPTIMIZER_INVALID_INPUT"),
    ("degeneriert", "OPTIMIZER_INVALID_INPUT"),
    ("mindestens 2 Assets", "OPTIMIZER_INVALID_INPUT"),
    ("Zu wenige Datenpunkte", "OPTIMIZER_INVALID_INPUT"),
    ("Die CSV", "UPLOAD_INVALID"),
    ("Pflichtspalten fehlen", "UPLOAD_INVALID"),
    ("Leere Ticker", "UPLOAD_INVALID"),
    ("Leere Gewichtswerte", "UPLOAD_INVALID"),
    ("Ungültiger Gewichtswert", "UPLOAD_INVALID"),
    ("Konfidenzniveau", "DOMAIN_ERROR"),
)

FALLBACK_CODE = "DOMAIN_ERROR"

# German snippets for the most common pydantic error types; request
# validation errors must not leak English pydantic text (contract §1.1).
_PYDANTIC_REASONS = {
    "missing": "Pflichtfeld fehlt",
    "int_parsing": "ganze Zahl erwartet",
    "int_type": "ganze Zahl erwartet",
    "float_parsing": "Zahl erwartet",
    "greater_than": "Wert ist zu klein",
    "greater_than_equal": "Wert ist zu klein",
    "timezone_aware": "Zeitstempel mit Zeitzone erwartet",
    "literal_error": "unzulässiger Wert",
    "string_type": "Text erwartet",
}


def error_code_for(message: str) -> str:
    """First matching registry fragment wins; unknown messages fall back."""
    for fragment, code in ERROR_CODE_REGISTRY:
        if fragment in message:
            return code
    return FALLBACK_CODE


def register_error_handlers(app: FastAPI) -> None:
    """Attach the three global handlers. Called once in main.py; every
    future router gets the convention for free."""

    @app.exception_handler(ValueError)
    async def domain_error(request: Request, exc: ValueError) -> JSONResponse:
        message = str(exc)
        return JSONResponse(
            status_code=422,
            content={"detail": message, "code": error_code_for(message)},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"] if part != "body")
        reason = _PYDANTIC_REASONS.get(first["type"], "ungültiger Wert")
        return JSONResponse(
            status_code=422,
            content={
                "detail": f"Ungültige Eingabe im Feld '{field}': {reason}.",
                "code": "VALIDATION_ERROR",
            },
        )

    @app.exception_handler(ConnectionError)
    @app.exception_handler(TimeoutError)
    @app.exception_handler(requests.RequestException)
    async def upstream_error(request: Request, exc: Exception) -> JSONResponse:
        # Transport failures only. An EMPTY yfinance answer stays a 422
        # TICKER_NOT_FOUND — it can just as well be a typo in the symbol.
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Kursdatenquelle derzeit nicht erreichbar. "
                    "Bitte später erneut versuchen."
                ),
                "code": "UPSTREAM_UNAVAILABLE",
            },
        )
