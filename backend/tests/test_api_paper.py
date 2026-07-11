"""Integration tests for the paper/* reference router (API_CONTRACT.md
§2.7–§2.9): happy path plus at least one error case per endpoint, each
error asserting the {detail, code} contract shape. yfinance is mocked
like everywhere else in the suite.
"""

import pytest
from fastapi.testclient import TestClient

from sentinel_api.errors import FALLBACK_CODE, error_code_for
from sentinel_api.main import app
from sentinel_core.data import loader
from test_loader import patch_download
from test_paper import price_frame

client = TestClient(app)

ACCOUNT = {
    "id": "acc-1",
    "name": "Test-Depot",
    "start_cash": 10_000.0,
    "created_at": "2026-01-01T00:00:00+00:00",
}


def tx_payload(
    ticker: str,
    side: str,
    quantity: int,
    price: float,
    executed_at: str = "2026-01-02T10:00:00+00:00",
) -> dict:
    return {
        "id": f"tx-{ticker}-{side}-{quantity}",
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
        "fees": 1.0,
        "executed_at": executed_at,
    }


# --- registry unit checks (precedence matters, API_CONTRACT §1.1) ------------


def test_registry_precedence_and_fallback():
    assert (
        error_code_for("Verkaufserlös deckt die Gebühr nicht: Erlös 0,50 €…")
        == "PAPER_FEE_NOT_COVERED"
    )
    assert (
        error_code_for("Verkauf von 15 Stück NVDA nicht möglich, nur 10 im Depot.")
        == "PAPER_INSUFFICIENT_HOLDINGS"  # NOT ..._CASH: case-sensitive match
    )
    assert error_code_for("Kauf von 2 Stück AAPL nicht möglich…")
    assert error_code_for("Völlig unbekannte Meldung") == FALLBACK_CODE


# --- /health ------------------------------------------------------------------


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# --- /paper/quote ---------------------------------------------------------------


def test_quote_happy_path(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))

    response = client.post(
        "/paper/quote", json={"ticker": "AAPL", "side": "BUY", "quantity": 5}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["price"] == 100.0
    assert body["fees"] == 1.0
    assert body["cash_delta"] == pytest.approx(-501.0)
    assert body["price_asof"] is not None


def test_quote_zero_quantity_maps_to_contract_error(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))

    response = client.post(
        "/paper/quote", json={"ticker": "AAPL", "side": "BUY", "quantity": 0}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "PAPER_INVALID_QUANTITY"
    assert "Menge muss" in body["detail"]


# --- /paper/execute -------------------------------------------------------------


def test_execute_happy_path_returns_only_the_new_transaction(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 123.0}))

    response = client.post(
        "/paper/execute",
        json={
            "account": ACCOUNT,
            "transactions": [],
            "ticker": "AAPL",
            "side": "BUY",
            "quantity": 10,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["side"] == "BUY"
    assert body["quantity"] == 10
    assert body["price"] == 123.0
    assert body["fees"] == 1.0
    assert body["account_id"] == "acc-1"
    assert body["id"] and body["executed_at"]


def test_execute_sell_beyond_holdings_gives_contract_error(monkeypatch):
    patch_download(monkeypatch, price_frame({"NVDA": 100.0}))

    response = client.post(
        "/paper/execute",
        json={
            "account": ACCOUNT,
            "transactions": [tx_payload("NVDA", "BUY", 10, 90.0)],
            "ticker": "NVDA",
            "side": "SELL",
            "quantity": 15,
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "PAPER_INSUFFICIENT_HOLDINGS"
    assert "nur 10 im Depot" in body["detail"]


def test_execute_naive_timestamp_gives_german_validation_error(monkeypatch):
    patch_download(monkeypatch, price_frame({"NVDA": 100.0}))
    naive = tx_payload("NVDA", "BUY", 10, 90.0, executed_at="2026-01-02T10:00:00")

    response = client.post(
        "/paper/execute",
        json={
            "account": ACCOUNT,
            "transactions": [naive],
            "ticker": "NVDA",
            "side": "SELL",
            "quantity": 5,
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert "transactions.0.executed_at" in body["detail"]
    assert "Zeitzone" in body["detail"]  # German, no pydantic English leaking


# --- /paper/valuation ------------------------------------------------------------


def test_valuation_happy_path(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 110.0}))

    response = client.post(
        "/paper/valuation",
        json={
            "account": ACCOUNT,
            "transactions": [tx_payload("AAPL", "BUY", 10, 100.0)],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cash"] == pytest.approx(8_999.0)
    assert body["total_value"] == pytest.approx(10_099.0)
    assert body["total_pnl_pct"] == pytest.approx(0.0099)
    assert body["positions"][0]["ticker"] == "AAPL"


def test_valuation_cash_only_needs_no_price_lookup(monkeypatch):
    def fail_download(*args, **kwargs):
        pytest.fail("Cash-only-Depot darf keinen Kurs-Lookup auslösen")

    monkeypatch.setattr(loader.yf, "download", fail_download)

    response = client.post(
        "/paper/valuation", json={"account": ACCOUNT, "transactions": []}
    )

    assert response.status_code == 200
    assert response.json()["total_value"] == 10_000.0


def test_valuation_corrupt_history_gives_contract_error(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 110.0}))

    response = client.post(
        "/paper/valuation",
        json={
            "account": ACCOUNT,
            "transactions": [tx_payload("AAPL", "SELL", 5, 100.0)],
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "PAPER_INSUFFICIENT_HOLDINGS"
    assert "nur 0 im Depot" in body["detail"]
