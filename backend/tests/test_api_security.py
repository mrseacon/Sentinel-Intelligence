"""Security audit regression tests (F1/F2/F4/F5/F7 + 500-handler):
size caps, ticker allowlist at every entry, streaming upload limit,
narrowed domain-error handler, uniform {detail, code} even for 500s.
"""

import pytest
from fastapi.testclient import TestClient

from sentinel_api.errors import error_code_for
from sentinel_api.limits import (
    MAX_PORTFOLIO_TICKERS,
    MAX_TRANSACTIONS,
)
from sentinel_api.main import app
from sentinel_api.routers import paper as paper_router_module
from sentinel_api.schemas.common import PortfolioIn
from sentinel_core.data import loader
from sentinel_core.errors import SentinelError
from test_loader import patch_download
from test_paper import price_frame

client = TestClient(app)
# separate client for 500 tests: do not re-raise server exceptions
client_no_raise = TestClient(app, raise_server_exceptions=False)

ACCOUNT = {
    "id": "acc-1",
    "name": "Test-Depot",
    "start_cash": 10_000.0,
    "created_at": "2026-01-01T00:00:00+00:00",
}


# --- F5: ticker allowlist -----------------------------------------------------


def test_validate_ticker_accepts_all_yahoo_notations():
    for ticker in ["AAPL", "BMW.DE", "BRK-B", "^GSPC", "EURUSD=X"]:
        assert loader.validate_ticker(ticker) == ticker


@pytest.mark.parametrize(
    "bad", ["AAPL MSFT", "A?B", "a/../etc", "X" * 16, "", "AAPL&crumb=1"]
)
def test_validate_ticker_rejects_url_metacharacters(bad):
    with pytest.raises(SentinelError, match="Ungültiges Tickersymbol"):
        loader.validate_ticker(bad)


def test_loader_validates_before_any_outbound_request(monkeypatch):
    def fail_download(*args, **kwargs):
        pytest.fail("ungültiger Ticker darf keinen Yahoo-Request auslösen")

    monkeypatch.setattr(loader.yf, "download", fail_download)

    with pytest.raises(SentinelError, match="Ungültiges Tickersymbol"):
        loader.load_multiple_assets(["AAPL/../v8"])


def test_quote_with_url_metacharacters_gives_german_validation_error():
    response = client.post(
        "/paper/quote",
        json={"ticker": "AAPL/../v8", "side": "BUY", "quantity": 1},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert "Ungültiges Tickersymbol" in body["detail"]


def test_weights_key_with_metacharacters_is_rejected():
    response = client.post(
        "/risk/ampel",
        json={"portfolio": {"weights": {"AAPL": 0.5, "../etc": 0.5}}},
    )

    assert response.status_code == 422
    assert "Ungültiges Tickersymbol" in response.json()["detail"]


def test_lowercase_tickers_are_normalized_not_rejected(monkeypatch):
    patch_download(monkeypatch, price_frame({"AAPL": 100.0}))

    response = client.post(
        "/paper/quote", json={"ticker": " aapl ", "side": "BUY", "quantity": 1}
    )

    assert response.status_code == 200
    assert response.json()["ticker"] == "AAPL"


def test_weights_keys_colliding_after_normalization_are_summed():
    # matches the CSV upload's documented duplicate semantics (§10)
    result = PortfolioIn(weights={"aapl": 1.0, "AAPL": 2.0})

    assert result.weights == {"AAPL": 3.0}


# --- F1: size caps -------------------------------------------------------------


def test_too_many_portfolio_tickers_are_rejected():
    weights = {f"T{i}": 1.0 for i in range(MAX_PORTFOLIO_TICKERS + 1)}

    response = client.post("/risk/ampel", json={"portfolio": {"weights": weights}})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert f"maximal {MAX_PORTFOLIO_TICKERS}" in body["detail"]


def test_too_many_transactions_are_rejected():
    transaction = {
        "id": "t",
        "ticker": "AAPL",
        "side": "BUY",
        "quantity": 1,
        "price": 1.0,
        "fees": 1.0,
        "executed_at": "2026-01-02T10:00:00+00:00",
    }

    response = client.post(
        "/paper/valuation",
        json={
            "account": ACCOUNT,
            "transactions": [transaction] * (MAX_TRANSACTIONS + 1),
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert f"maximal {MAX_TRANSACTIONS}" in body["detail"]


def test_body_over_global_cap_gives_413():
    huge = b"x" * 2_500_000  # > MAX_BODY_BYTES incl. multipart overhead

    response = client.post(
        "/portfolio/upload", files={"file": ("depot.csv", huge, "text/csv")}
    )

    assert response.status_code == 413
    body = response.json()
    assert body["code"] == "PAYLOAD_TOO_LARGE"
    assert "zu groß" in body["detail"]


# --- F2: upload hardening -------------------------------------------------------


def test_upload_non_csv_extension_is_rejected():
    response = client.post(
        "/portfolio/upload",
        files={"file": ("depot.txt", b"ticker,weight\nAAPL,1\n", "text/plain")},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "UPLOAD_INVALID"
    assert "Nur CSV-Dateien" in body["detail"]


def test_upload_over_csv_cap_is_aborted_while_streaming():
    # ~1.2 MB: passes the 2 MB global body cap, hits the 1 MB CSV cap
    rows = b"AAAA,1\n" * 170_000
    payload = b"ticker,weight\n" + rows

    response = client.post(
        "/portfolio/upload", files={"file": ("depot.csv", payload, "text/csv")}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "UPLOAD_INVALID"
    assert "zu groß" in body["detail"]


def test_upload_with_too_many_positions_is_rejected():
    rows = "".join(f"T{i},1\n" for i in range(MAX_PORTFOLIO_TICKERS + 10))
    payload = ("ticker,weight\n" + rows).encode()

    response = client.post(
        "/portfolio/upload", files={"file": ("depot.csv", payload, "text/csv")}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "UPLOAD_INVALID"
    assert "zu viele Positionen" in body["detail"]


def test_upload_formula_injection_ticker_is_rejected_as_invalid_symbol():
    payload = b'ticker,weight\n"=CMD|CALC!A1",1\nAAPL,1\n'

    response = client.post(
        "/portfolio/upload", files={"file": ("depot.csv", payload, "text/csv")}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "TICKER_INVALID"
    assert "Ungültiges Tickersymbol" in body["detail"]


# --- F7: narrowed handler + uniform 500 -----------------------------------------


def test_foreign_valueerror_becomes_generic_500_without_leaking(monkeypatch):
    def library_internal_failure(account, transactions):
        raise ValueError("cannot reindex on an axis with duplicate labels")

    monkeypatch.setattr(paper_router_module, "value_account", library_internal_failure)

    response = client_no_raise.post(
        "/paper/valuation", json={"account": ACCOUNT, "transactions": []}
    )

    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert "reindex" not in body["detail"]  # no library text leaks
    assert "Interner Serverfehler" in body["detail"]


def test_sentinel_errors_keep_the_422_contract(monkeypatch):
    # unchanged domain behaviour after the handler narrowing
    patch_download(monkeypatch, price_frame({"NVDA": 100.0}))

    response = client.post(
        "/paper/quote", json={"ticker": "NVDA", "side": "BUY", "quantity": 0}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "PAPER_INVALID_QUANTITY"


def test_new_registry_entries():
    assert error_code_for("Ungültiges Tickersymbol: 'X?'…") == "TICKER_INVALID"
    assert error_code_for("Nur CSV-Dateien werden unterstützt…") == "UPLOAD_INVALID"
    assert (
        error_code_for("Die CSV enthält zu viele Positionen (60, maximal 50).")
        == "UPLOAD_INVALID"
    )
