"""Integration tests for GET /risk/benchmarks and POST /risk/benchmark-compare.

yfinance is mocked per-ticker: portfolio tickers reuse the realistic
sample_returns() fixture, the benchmark ticker gets a distinctly calmer
series (so the two sides are guaranteed to be genuinely different, not
just the same numbers echoed twice), and anything else comes back as an
all-NaN column like real yfinance does for an unknown symbol.
"""

from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from sentinel_api.main import app
from sentinel_core.data import loader
from test_ampel import FORBIDDEN_ACTION_STEMS
from test_risk_metrics import TICKERS as PORTFOLIO_TICKERS
from test_risk_metrics import sample_returns

client = TestClient(app)

WEIGHTS = {"AAPL": 0.4, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.1}
_PORTFOLIO_RETURNS = sample_returns()
# Distinctly calmer than the portfolio fixture (scaled down), and offset
# so it isn't a trivial rescale of the same series.
_BENCHMARK_RETURNS = sample_returns(columns=["SPY", "URTH"], seed=99) * 0.3


def _fake_download(
    tickers,
    period=None,
    start=None,
    end=None,
    auto_adjust=None,
    progress=None,
    **kwargs,
):
    assert auto_adjust is False
    ticker_list = tickers if isinstance(tickers, list) else [tickers]
    index = _PORTFOLIO_RETURNS.index
    price_columns: dict[str, pd.Series] = {}
    for ticker in ticker_list:
        if ticker in PORTFOLIO_TICKERS:
            price_columns[ticker] = 100 * (1 + _PORTFOLIO_RETURNS[ticker]).cumprod()
        elif ticker in _BENCHMARK_RETURNS.columns:
            price_columns[ticker] = 100 * (1 + _BENCHMARK_RETURNS[ticker]).cumprod()
        else:
            # Unknown symbol: real yfinance comes back with an all-NaN
            # column rather than raising, loader.py rejects those by name.
            price_columns[ticker] = pd.Series(float("nan"), index=index)
    frame = pd.DataFrame(price_columns)
    frame.columns = pd.MultiIndex.from_product([["Adj Close"], list(frame.columns)])
    return frame


def _patch_market(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(loader.yf, "download", _fake_download)


def test_list_benchmarks_returns_fixed_options():
    response = client.get("/risk/benchmarks")

    assert response.status_code == 200
    body = response.json()
    ids = {b["id"] for b in body["benchmarks"]}
    assert ids == {"msci_world", "sp500"}
    for benchmark in body["benchmarks"]:
        assert benchmark["title"]


def test_benchmark_compare_happy_path_gives_distinguishable_values(monkeypatch):
    _patch_market(monkeypatch)

    response = client.post(
        "/risk/benchmark-compare",
        json={"portfolio": {"weights": WEIGHTS}, "benchmark_id": "sp500"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["benchmark_id"] == "sp500"
    assert body["benchmark_title"]
    assert set(body["portfolio"]) == {"metrics", "score"}
    assert set(body["benchmark"]) == {"metrics", "score"}

    portfolio_vol = body["portfolio"]["metrics"]["volatility"]
    benchmark_vol = body["benchmark"]["metrics"]["volatility"]
    # Genuinely different, plausible values (not the same side echoed
    # twice): the portfolio fixture is deliberately the noisier series.
    assert portfolio_vol > benchmark_vol > 0
    assert body["portfolio"]["score"]["score"] != pytest.approx(
        body["benchmark"]["score"]["score"]
    )

    assert body["comparison"]
    text_lower = body["comparison"].lower()
    for stem in FORBIDDEN_ACTION_STEMS:
        assert stem not in text_lower


def test_benchmark_compare_unknown_id_gives_contract_error(monkeypatch):
    _patch_market(monkeypatch)

    response = client.post(
        "/risk/benchmark-compare",
        json={"portfolio": {"weights": WEIGHTS}, "benchmark_id": "nasdaq"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "BENCHMARK_UNKNOWN"
    assert "nasdaq" in body["detail"]


def test_benchmark_compare_unknown_ticker_gives_contract_error(monkeypatch):
    _patch_market(monkeypatch)

    response = client.post(
        "/risk/benchmark-compare",
        json={"portfolio": {"weights": {"ZZZZ": 1.0}}, "benchmark_id": "sp500"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "TICKER_NOT_FOUND"
    assert "ZZZZ" in body["detail"]
