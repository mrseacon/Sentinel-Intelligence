"""Integration tests for the risk/* router (API_CONTRACT.md §2.4–§2.5):
happy path plus a {detail, code}-asserted error per endpoint. yfinance is
mocked like everywhere else in the suite.
"""

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from sentinel_api.main import app
from test_loader import patch_download
from test_risk_metrics import sample_returns

client = TestClient(app)

WEIGHTS = {"AAPL": 0.4, "MSFT": 0.3, "NVDA": 0.2, "SAP.DE": 0.1}


def price_frame_from_returns(returns: pd.DataFrame) -> pd.DataFrame:
    """Raw yfinance-style Adj Close frame built from a returns series —
    lets these tests reuse the realistic sample_returns() fixture
    instead of hand-crafting prices."""
    prices = 100 * (1 + returns).cumprod()
    frame = prices.copy()
    frame.columns = pd.MultiIndex.from_product([["Adj Close"], prices.columns])
    return frame


# --- /risk/analyze --------------------------------------------------------------


def test_risk_analyze_happy_path(monkeypatch):
    patch_download(monkeypatch, price_frame_from_returns(sample_returns()))

    response = client.post("/risk/analyze", json={"portfolio": {"weights": WEIGHTS}})

    assert response.status_code == 200
    body = response.json()
    assert set(body["metrics"]) == {
        "volatility",
        "max_drawdown",
        "var_95",
        "cvar_95",
        "hhi",
        "diversification_ratio",
    }
    assert body["metrics"]["max_drawdown"] <= 0
    assert body["metrics"]["hhi"] is not None  # 4 assets -> concentration defined
    assert 0 <= body["score"]["score"] <= 100
    assert body["score"]["label"] in {"Low", "Moderate", "High", "Severe"}
    assert len(body["score"]["drivers"]) <= 3
    assert "factor" in body["score"]["drivers"][0]
    assert sum(body["risk_contribution"].values()) == pytest.approx(1.0)


def test_risk_analyze_unknown_ticker_gives_contract_error(monkeypatch):
    patch_download(monkeypatch, price_frame_from_returns(sample_returns()))

    response = client.post(
        "/risk/analyze",
        json={"portfolio": {"weights": {"AAPL": 0.5, "ZZZZ": 0.5}}},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "TICKER_NOT_FOUND"
    assert "ZZZZ" in body["detail"]


# --- /risk/ampel ------------------------------------------------------------------


def test_risk_ampel_happy_path_returns_three_lights_in_order(monkeypatch):
    patch_download(monkeypatch, price_frame_from_returns(sample_returns()))

    response = client.post("/risk/ampel", json={"portfolio": {"weights": WEIGHTS}})

    assert response.status_code == 200
    body = response.json()
    assert [a["id"] for a in body["ampeln"]] == [
        "concentration",
        "diversification",
        "volatility",
    ]
    for ampel in body["ampeln"]:
        assert ampel["status"] in {"green", "yellow", "red"}
        assert ampel["explanation"] and ampel["lesson"]


def test_risk_ampel_negative_weight_gives_contract_error(monkeypatch):
    patch_download(monkeypatch, price_frame_from_returns(sample_returns()))

    response = client.post(
        "/risk/ampel",
        json={"portfolio": {"weights": {"AAPL": 1.2, "MSFT": -0.2}}},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "PORTFOLIO_INVALID"
    assert "Negative Gewichte" in body["detail"]
    assert "MSFT" in body["detail"]
