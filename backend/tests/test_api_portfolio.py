"""Integration tests for the portfolio/* router (API_CONTRACT.md §2.6,
§2.12a): happy path plus a {detail, code}-asserted error per endpoint.
yfinance is mocked like everywhere else in the suite.
"""

import pandas as pd
from fastapi.testclient import TestClient

from sentinel_api.main import app
from test_loader import patch_download
from test_risk_metrics import sample_returns

client = TestClient(app)


def price_frame_from_returns(returns: pd.DataFrame) -> pd.DataFrame:
    prices = 100 * (1 + returns).cumprod()
    frame = prices.copy()
    frame.columns = pd.MultiIndex.from_product([["Adj Close"], prices.columns])
    return frame


# --- /portfolio/optimize --------------------------------------------------------


def test_optimize_happy_path_includes_mandatory_disclaimer(monkeypatch):
    patch_download(
        monkeypatch, price_frame_from_returns(sample_returns(["AAPL", "MSFT"]))
    )

    response = client.post("/portfolio/optimize", json={"tickers": ["AAPL", "MSFT"]})

    assert response.status_code == 200
    body = response.json()
    assert set(body["weights"]) == {"AAPL", "MSFT"}
    assert abs(sum(body["weights"].values()) - 1.0) < 1e-6
    assert body["disclaimer"]  # principle 3: never optional


def test_optimize_single_ticker_gives_contract_error(monkeypatch):
    patch_download(monkeypatch, price_frame_from_returns(sample_returns(["AAPL"])))

    response = client.post("/portfolio/optimize", json={"tickers": ["AAPL"]})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "OPTIMIZER_INVALID_INPUT"
    assert "mindestens 2 Assets" in body["detail"]


# --- /portfolio/upload -----------------------------------------------------------


def test_upload_happy_path():
    csv = b"ticker,weight\nAAPL,0.6\nMSFT,0.4\n"

    response = client.post(
        "/portfolio/upload",
        files={"file": ("depot.csv", csv, "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {"weights": {"AAPL": 0.6, "MSFT": 0.4}}


def test_upload_missing_column_gives_contract_error():
    csv = b"ticker,menge\nAAPL,5\n"

    response = client.post(
        "/portfolio/upload",
        files={"file": ("depot.csv", csv, "text/csv")},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "UPLOAD_INVALID"
    assert "Pflichtspalten fehlen" in body["detail"]
