"""Mandatory loader tests per ARCHITECTURE.md §9: yfinance format cases,
missing Adj Close, partially failing tickers. yfinance is mocked so the
suite runs offline (CI has no market data access).
"""

import numpy as np
import pandas as pd
import pytest

from sentinel_core.data import loader

DATES = pd.date_range("2026-01-02", periods=5, freq="B")


def multiindex_frame(
    fields: list[str], tickers: list[str], dates: pd.DatetimeIndex = DATES
) -> pd.DataFrame:
    """Raw yfinance multi-ticker layout: columns like ('Adj Close', 'AAPL')."""
    columns = pd.MultiIndex.from_product([fields, tickers])
    values = np.arange(len(dates) * len(columns), dtype=float).reshape(
        len(dates), len(columns)
    )
    return pd.DataFrame(values, index=dates, columns=columns)


def flat_frame(fields: list[str], dates: pd.DatetimeIndex = DATES) -> pd.DataFrame:
    """Raw yfinance single-ticker layout: flat OHLCV columns."""
    values = np.arange(len(dates) * len(fields), dtype=float).reshape(
        len(dates), len(fields)
    )
    return pd.DataFrame(values, index=dates, columns=fields)


def patch_download(monkeypatch: pytest.MonkeyPatch, frame: pd.DataFrame) -> None:
    def fake_download(tickers, period="1y", auto_adjust=None, progress=None):
        # Regression guard: without auto_adjust=False newer yfinance
        # versions drop "Adj Close" entirely (KNOWLEDGE_EXTRACTION §1).
        assert auto_adjust is False
        return frame

    monkeypatch.setattr(loader.yf, "download", fake_download)


def test_multiindex_adj_close_and_requested_column_order(monkeypatch):
    # yfinance returns columns alphabetically; we request MSFT first.
    raw = multiindex_frame(["Adj Close", "Close", "Volume"], ["AAPL", "MSFT"])
    patch_download(monkeypatch, raw)

    prices = loader.load_multiple_assets(["MSFT", "AAPL"])

    assert list(prices.columns) == ["MSFT", "AAPL"]
    pd.testing.assert_series_equal(
        prices["AAPL"], raw[("Adj Close", "AAPL")], check_names=False
    )


def test_multiindex_without_adj_close_falls_back_to_close(monkeypatch):
    raw = multiindex_frame(["Close", "Volume"], ["AAPL", "MSFT"])
    patch_download(monkeypatch, raw)

    prices = loader.load_multiple_assets(["AAPL", "MSFT"])

    pd.testing.assert_series_equal(
        prices["MSFT"], raw[("Close", "MSFT")], check_names=False
    )


def test_flat_single_ticker_becomes_dataframe_named_after_ticker(monkeypatch):
    raw = flat_frame(["Open", "High", "Low", "Close", "Adj Close", "Volume"])
    patch_download(monkeypatch, raw)

    prices = loader.load_multiple_assets(["AAPL"])

    assert isinstance(prices, pd.DataFrame)
    assert list(prices.columns) == ["AAPL"]
    pd.testing.assert_series_equal(prices["AAPL"], raw["Adj Close"], check_names=False)


def test_flat_single_ticker_close_only_fallback(monkeypatch):
    raw = flat_frame(["Open", "Close", "Volume"])
    patch_download(monkeypatch, raw)

    prices = loader.load_multiple_assets(["AAPL"])

    pd.testing.assert_series_equal(prices["AAPL"], raw["Close"], check_names=False)


def test_no_price_column_at_all_raises_keyerror(monkeypatch):
    patch_download(monkeypatch, flat_frame(["Open", "Volume"]))

    with pytest.raises(KeyError, match="Adj Close"):
        loader.load_multiple_assets(["AAPL"])


def test_empty_response_raises_valueerror(monkeypatch):
    patch_download(monkeypatch, pd.DataFrame())

    with pytest.raises(ValueError, match="No price data returned"):
        loader.load_multiple_assets(["AAPL"])


def test_missing_ticker_is_named_explicitly(monkeypatch):
    # Misspelled tickers come back as silent all-NaN columns, not errors.
    raw = multiindex_frame(["Adj Close"], ["AAPL", "FAKETICKER"])
    raw[("Adj Close", "FAKETICKER")] = np.nan
    patch_download(monkeypatch, raw)

    with pytest.raises(ValueError, match="FAKETICKER") as excinfo:
        loader.load_multiple_assets(["AAPL", "FAKETICKER"])
    assert "AAPL" not in str(excinfo.value).split(":")[1]


def test_ticker_absent_from_response_is_named_explicitly(monkeypatch):
    raw = multiindex_frame(["Adj Close"], ["AAPL"])
    patch_download(monkeypatch, raw)

    with pytest.raises(ValueError, match="MSFT"):
        loader.load_multiple_assets(["AAPL", "MSFT"])


def test_shorter_history_does_not_wipe_other_assets(monkeypatch):
    # LATE has data only for the last two days (late IPO). dropna(how="all")
    # must keep the earlier AAPL rows instead of emptying the frame.
    raw = multiindex_frame(["Adj Close"], ["AAPL", "LATE"])
    raw.loc[DATES[:3], ("Adj Close", "LATE")] = np.nan
    patch_download(monkeypatch, raw)

    prices = loader.load_multiple_assets(["AAPL", "LATE"])

    assert len(prices) == len(DATES)
    assert prices["AAPL"].notna().all()
    assert prices["LATE"].isna().sum() == 3


def test_row_where_all_assets_missing_is_dropped(monkeypatch):
    raw = multiindex_frame(["Adj Close"], ["AAPL", "MSFT"])
    raw.loc[DATES[0], :] = np.nan
    patch_download(monkeypatch, raw)

    prices = loader.load_multiple_assets(["AAPL", "MSFT"])

    assert len(prices) == len(DATES) - 1
    assert DATES[0] not in prices.index


def test_empty_ticker_list_raises(monkeypatch):
    patch_download(monkeypatch, pd.DataFrame())

    with pytest.raises(ValueError, match="No tickers"):
        loader.load_multiple_assets([])
