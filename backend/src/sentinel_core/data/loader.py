"""Price data loading via yfinance (KNOWLEDGE_EXTRACTION.md §1).

yfinance is the most fragile part of the system: depending on ticker count
and Yahoo's mood it returns three different column layouts, sometimes omits
"Adj Close" entirely, silently yields all-NaN columns for unknown tickers
and reorders columns alphabetically. Every branch in this module guards one
of those documented failure modes — do not simplify them away.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
import yfinance as yf
from pydantic import BaseModel, ConfigDict


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
        raise ValueError(
            "Keine Ticker angegeben: mindestens ein Tickersymbol wird benötigt."
        )

    # auto_adjust=False is deliberate: newer yfinance versions default to
    # auto_adjust=True, which removes the "Adj Close" column entirely.
    if start or end:
        window = f"{start} bis {end}"
        data = yf.download(
            tickers, start=start, end=end, auto_adjust=False, progress=False
        )
    else:
        window = period
        data = yf.download(tickers, period=period, auto_adjust=False, progress=False)

    if data is None or data.empty:
        raise ValueError(
            f"Keine Kursdaten erhalten für {', '.join(tickers)} "
            f"(Zeitraum: {window})."
        )

    prices = _extract_prices(data, tickers)

    # Unknown/misspelled tickers do not raise inside yfinance — they come
    # back as silent all-NaN columns. Reject them by name instead.
    missing = [t for t in tickers if t not in prices.columns or prices[t].isna().all()]
    if missing:
        raise ValueError(
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
            raise ValueError(f"Keine Kursdaten für Ticker: {ticker}.")
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
        raise ValueError(
            f"Kursdaten für {', '.join(tickers)} enthalten weder eine "
            "'Adj Close'- noch eine 'Close'-Spalte."
        )

    # Single-ticker responses collapse to a Series here; the rest of the
    # pipeline expects a DataFrame keyed by ticker name.
    if isinstance(prices, pd.Series):
        prices = prices.to_frame(name=tickers[0])
    return prices
