"""Integration tests for POST /reports/risk-summary.

Uses fake tickers (RPT1..RPT4) rather than real symbols so the stress-
replay leg of this endpoint never writes bogus data into the real
backend/.cache/stress/v1 cache under a real ticker's name (same
convention as test_stress.py's OLD1/OLD2/YOUNG).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from sentinel_api.main import app
from sentinel_core.data import loader

client = TestClient(app)

WEIGHTS = {"RPT1": 0.4, "RPT2": 0.3, "RPT3": 0.2, "RPT4": 0.1}

# Spans well before the covid_2020 preset window (2020-02-19..2020-03-23)
# through "today", so both the analyze/ampel load (period="1y") and the
# stress-replay load (fixed 2020 window) get valid, in-range data from
# the same mock.
_INDEX = pd.bdate_range("2019-06-01", pd.Timestamp.today().normalize())


def _series_for(ticker: str) -> pd.Series:
    # Unknown tickers must come back as an all-NaN column, mirroring real
    # yfinance's silent behaviour for a bad symbol (loader.py rejects
    # those by name) — otherwise the error-path test below would get a
    # (wrong) 200 instead of TICKER_NOT_FOUND.
    if ticker not in WEIGHTS:
        return pd.Series(np.nan, index=_INDEX)
    # Deterministic per-ticker seed so the same ticker always yields the
    # same series regardless of whether it's fetched alone (stress) or
    # as part of a batch (analyze/ampel) — real yfinance calls differ in
    # shape between load_multiple_assets (ticker list) and
    # load_preset_prices (one ticker at a time).
    seed = sum(ord(c) for c in ticker)
    rng = np.random.default_rng(seed)
    daily = rng.normal(0.0004, 0.012, size=len(_INDEX))
    return 100 * (1 + pd.Series(daily, index=_INDEX)).cumprod()


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
    frame = pd.DataFrame({t: _series_for(t) for t in ticker_list})
    frame.columns = pd.MultiIndex.from_product([["Adj Close"], list(frame.columns)])
    return frame


def _patch_market(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(loader.yf, "download", _fake_download)


def test_risk_summary_pdf_happy_path(monkeypatch):
    _patch_market(monkeypatch)

    response = client.post(
        "/reports/risk-summary", json={"portfolio": {"weights": WEIGHTS}}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert ".pdf" in response.headers["content-disposition"]
    # PDF magic bytes (%PDF-) — a corrupt/partial render would not start
    # with this header.
    assert response.content[:5] == b"%PDF-"
    assert len(response.content) > 1000  # sanity: not an empty/broken PDF


def test_risk_summary_unknown_ticker_gives_contract_error(monkeypatch):
    _patch_market(monkeypatch)

    response = client.post(
        "/reports/risk-summary",
        json={"portfolio": {"weights": {"RPT1": 0.5, "ZZZZ": 0.5}}},
    )

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"detail", "code"}
    assert body["code"] == "TICKER_NOT_FOUND"
    assert "ZZZZ" in body["detail"]
    # A failed request must never leak a partial/broken PDF body.
    assert not response.content.startswith(b"%PDF-")


def test_risk_summary_negative_weight_gives_contract_error(monkeypatch):
    _patch_market(monkeypatch)

    response = client.post(
        "/reports/risk-summary",
        json={"portfolio": {"weights": {"RPT1": -0.5, "RPT2": 1.5}}},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "PORTFOLIO_INVALID"
