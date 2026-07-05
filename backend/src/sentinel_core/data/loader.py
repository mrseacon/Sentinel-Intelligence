"""Price data loading via yfinance (KNOWLEDGE_EXTRACTION.md §1).

yfinance is the most fragile part of the system: depending on ticker count
and Yahoo's mood it returns three different column layouts, sometimes omits
"Adj Close" entirely, silently yields all-NaN columns for unknown tickers
and reorders columns alphabetically. Every branch in this module guards one
of those documented failure modes — do not simplify them away.
"""

from __future__ import annotations

import pandas as pd
import yfinance as yf


def load_multiple_assets(tickers: list[str], period: str = "1y") -> pd.DataFrame:
    """Load daily prices for the given tickers.

    Returns a DataFrame with one price column per ticker, in the requested
    order, using adjusted close prices (falling back to close).

    Raises:
        ValueError: empty ticker list, empty yfinance response, missing
            price columns, or tickers for which no data came back (named
            explicitly in the message). All data errors are ValueError so
            the API layer can map them uniformly (deliberate deviation from
            the legacy KeyError in KNOWLEDGE_EXTRACTION §1).
    """
    if not tickers:
        raise ValueError("No tickers given: provide at least one ticker symbol.")

    # auto_adjust=False is deliberate: newer yfinance versions default to
    # auto_adjust=True, which removes the "Adj Close" column entirely.
    data = yf.download(tickers, period=period, auto_adjust=False, progress=False)

    if data is None or data.empty:
        raise ValueError(
            f"No price data returned for {', '.join(tickers)} (period={period!r})."
        )

    prices = _extract_prices(data, tickers)

    # Unknown/misspelled tickers do not raise inside yfinance — they come
    # back as silent all-NaN columns. Reject them by name instead.
    missing = [t for t in tickers if t not in prices.columns or prices[t].isna().all()]
    if missing:
        raise ValueError(
            "No price data for ticker(s): "
            + ", ".join(missing)
            + ". Check the symbol spelling (Yahoo notation, e.g. 'BMW.DE')."
        )

    # how="all": assets with shorter histories (e.g. a late IPO) must not
    # wipe the whole frame; only drop rows where every asset is missing.
    prices = prices.dropna(how="all")

    # yfinance sometimes reorders columns alphabetically; restore the
    # requested order explicitly. Downstream risk code must still align by
    # ticker name (CLAUDE.md rule 2) — this is defense in depth, not the fix.
    return prices[tickers]


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
            f"yfinance response for {', '.join(tickers)} contains neither "
            "'Adj Close' nor 'Close' columns."
        )

    # Single-ticker responses collapse to a Series here; the rest of the
    # pipeline expects a DataFrame keyed by ticker name.
    if isinstance(prices, pd.Series):
        prices = prices.to_frame(name=tickers[0])
    return prices
