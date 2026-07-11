"""Integration tests for the simulation/* router (API_CONTRACT.md
§2.11): happy path plus a {detail, code}-asserted error. yfinance is
mocked like everywhere else in the suite.
"""

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from sentinel_api.main import app
from test_loader import patch_download

client = TestClient(app)


def synthetic_prices(days: int, tickers: list[str], seed: int = 11) -> pd.DataFrame:
    """Raw yfinance-style Adj Close frame long enough to clear
    SIM_MIN_HISTORY_DAYS (250)."""
    rng = np.random.default_rng(seed)
    returns = rng.normal(0.0004, 0.01, size=(days, len(tickers)))
    prices = 100 * np.cumprod(1 + returns, axis=0)
    frame = pd.DataFrame(
        prices, columns=tickers, index=pd.bdate_range("2021-01-04", periods=days)
    )
    frame.columns = pd.MultiIndex.from_product([["Adj Close"], tickers])
    return frame


def test_monte_carlo_happy_path(monkeypatch):
    patch_download(monkeypatch, synthetic_prices(400, ["AAPL", "MSFT"]))

    response = client.post(
        "/simulation/monte-carlo",
        json={"portfolio": {"weights": {"AAPL": 0.6, "MSFT": 0.4}}, "horizon_years": 1},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["horizon_years"] == 1
    assert body["trading_days"][0] == 0
    assert body["p10"][0] == body["p50"][0] == body["p90"][0] == 1.0
    assert body["p10"][-1] <= body["p50"][-1] <= body["p90"][-1]
    assert body["disclaimer"] and body["lesson"]


def test_monte_carlo_insufficient_history_gives_contract_error(monkeypatch):
    # Only 100 days: below SIM_MIN_HISTORY_DAYS (250).
    patch_download(monkeypatch, synthetic_prices(100, ["AAPL", "MSFT"]))

    response = client.post(
        "/simulation/monte-carlo",
        json={"portfolio": {"weights": {"AAPL": 0.6, "MSFT": 0.4}}, "horizon_years": 1},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "SIM_INSUFFICIENT_HISTORY"
    assert "Zu wenig Kurshistorie" in body["detail"]
