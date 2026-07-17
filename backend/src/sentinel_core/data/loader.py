"""Price data loading via yfinance (KNOWLEDGE_EXTRACTION.md §1).

yfinance is the most fragile part of the system: depending on ticker count
and Yahoo's mood it returns three different column layouts, sometimes omits
"Adj Close" entirely, silently yields all-NaN columns for unknown tickers
and reorders columns alphabetically. Every branch in this module guards one
of those documented failure modes — do not simplify them away.
"""

from __future__ import annotations

import re
from datetime import datetime

import pandas as pd
import yfinance as yf
from pydantic import BaseModel, ConfigDict

from sentinel_core.errors import SentinelError

# Outbound-boundary guard (security audit F5): tickers flow into Yahoo
# request URLs, so only real symbol characters may pass — never path or
# query metacharacters. Covers all Yahoo notations we use ('BMW.DE',
# 'BRK-B', '^GSPC', 'EURUSD=X').
TICKER_PATTERN = re.compile(r"^[A-Z0-9.\-^=]{1,15}$")

# A hanging Yahoo socket must not pin a threadpool thread forever
# (security audit F3); yfinance forwards this to requests.
_REQUEST_TIMEOUT_SECONDS = 15


def validate_ticker(ticker: str) -> str:
    """Validate a single ticker against the outbound allowlist.

    Called by load_multiple_assets for EVERY outbound request (covers all
    core paths incl. valuation-derived tickers) and by the API schemas
    for early, field-located errors. Expects normalized (uppercase)
    input — normalization is the caller's job, not silent repair here.
    """
    if not TICKER_PATTERN.match(ticker):
        raise SentinelError(
            f"Ungültiges Tickersymbol: '{ticker}'. Erlaubt sind 1-15 "
            "Zeichen aus A-Z, 0-9, '.', '-', '^' und '='."
        )
    return ticker


def load_multiple_assets(
    tickers: list[str],
    period: str = "1y",
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """Load daily prices for the given tickers.

    Returns a DataFrame with one price column per ticker, in the requested
    order, using adjusted close prices (falling back to close). Either a
    rolling `period` or an explicit `start`/`end` window (ISO dates; `end`
    is exclusive, as in yfinance).

    Raises:
        ValueError: empty ticker list, empty yfinance response, missing
            price columns, or tickers for which no data came back (named
            explicitly in the message). All data errors are ValueError so
            the API layer can map them uniformly (deliberate deviation from
            the legacy KeyError in KNOWLEDGE_EXTRACTION §1).
    """
    if not tickers:
        raise SentinelError(
            "Keine Ticker angegeben: mindestens ein Tickersymbol wird benötigt."
        )
    for ticker in tickers:
        validate_ticker(ticker)

    # auto_adjust=False is deliberate: newer yfinance versions default to
    # auto_adjust=True, which removes the "Adj Close" column entirely.
    if start or end:
        window = f"{start} bis {end}"
        data = yf.download(
            tickers,
            start=start,
            end=end,
            auto_adjust=False,
            progress=False,
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
    else:
        window = period
        data = yf.download(
            tickers,
            period=period,
            auto_adjust=False,
            progress=False,
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )

    if data is None or data.empty:
        raise SentinelError(
            f"Keine Kursdaten erhalten für {', '.join(tickers)} "
            f"(Zeitraum: {window})."
        )

    prices = _extract_prices(data, tickers)

    # Unknown/misspelled tickers do not raise inside yfinance — they come
    # back as silent all-NaN columns. Reject them by name instead.
    missing = [t for t in tickers if t not in prices.columns or prices[t].isna().all()]
    if missing:
        raise SentinelError(
            "Keine Kursdaten für Ticker: "
            + ", ".join(missing)
            + ". Bitte Schreibweise prüfen (Yahoo-Notation, z.B. 'BMW.DE')."
        )

    # how="all": assets with shorter histories (e.g. a late IPO) must not
    # wipe the whole frame; only drop rows where every asset is missing.
    prices = prices.dropna(how="all")

    # yfinance sometimes reorders columns alphabetically; restore the
    # requested order explicitly. Downstream risk code must still align by
    # ticker name (CLAUDE.md rule 2) — this is defense in depth, not the fix.
    return prices[tickers]


class LatestPrice(BaseModel):
    """Last available (delayed) price and its timestamp.

    The timestamp is user-facing: delayed quotes are acceptable but must be
    shown transparently ("Kurs von HH:MM", ARCHITECTURE §1).
    """

    model_config = ConfigDict(frozen=True)

    price: float
    asof: datetime


def get_latest_prices(tickers: list[str], period: str = "5d") -> dict[str, LatestPrice]:
    """Return the last available price per ticker with its timestamp.

    period="5d" bridges weekends and holidays; per ticker the last non-NaN
    value counts (assets can lag each other, e.g. different exchanges).
    """
    prices = load_multiple_assets(tickers, period=period)
    latest: dict[str, LatestPrice] = {}
    for ticker in tickers:
        series = prices[ticker].dropna()
        # load_multiple_assets already rejects all-NaN tickers by name;
        # this guard is defensive only.
        if series.empty:
            raise SentinelError(f"Keine Kursdaten für Ticker: {ticker}.")
        latest[ticker] = LatestPrice(
            price=float(series.iloc[-1]),
            asof=series.index[-1].to_pydatetime(),
        )
    return latest


def _extract_prices(data: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
    """Reduce a raw yfinance frame to one price column per ticker.

    Handles the three documented layouts: MultiIndex columns like
    ("Adj Close", "AAPL"), flat OHLCV columns for a single ticker, and the
    Series that falls out of selecting one column from a flat frame.
    Price field fallback chain: "Adj Close" -> "Close" -> ValueError.
    """
    fields = (
        data.columns.get_level_values(0)
        if isinstance(data.columns, pd.MultiIndex)
        else data.columns
    )
    for field in ("Adj Close", "Close"):
        if field in fields:
            prices = data[field]
            break
    else:
        raise SentinelError(
            f"Kursdaten für {', '.join(tickers)} enthalten weder eine "
            "'Adj Close'- noch eine 'Close'-Spalte."
        )

    # Single-ticker responses collapse to a Series here; the rest of the
    # pipeline expects a DataFrame keyed by ticker name.
    if isinstance(prices, pd.Series):
        prices = prices.to_frame(name=tickers[0])
    return prices
