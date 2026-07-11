"""Integration tests for the stress/* router (API_CONTRACT.md §2.10,
§2.12): happy path plus a {detail, code}-asserted error per endpoint.
yfinance is mocked via test_stress's fake_market helper.
"""

from fastapi.testclient import TestClient

from sentinel_api.main import app
from test_stress import GFC_WINDOW, declining_series, fake_market

client = TestClient(app)


# --- /stress/replay ------------------------------------------------------------


def test_stress_replay_happy_path(monkeypatch):
    fake_market(
        monkeypatch,
        {
            "OLD1": declining_series(GFC_WINDOW),
            "OLD2": declining_series(GFC_WINDOW) * 2,
        },
    )

    response = client.post(
        "/stress/replay",
        json={
            "portfolio": {"weights": {"OLD1": 0.5, "OLD2": 0.5}},
            "preset_id": "gfc_2008",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["preset_id"] == "gfc_2008"
    assert body["coverage"] == 1.0
    assert len(body["dates"]) == len(body["value_path"])
    assert body["value_path"][0] == 1.0
    assert body["disclaimer"]


def test_stress_replay_unknown_preset_gives_contract_error():
    response = client.post(
        "/stress/replay",
        json={"portfolio": {"weights": {"AAPL": 1.0}}, "preset_id": "dotcom"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "STRESS_UNKNOWN_PRESET"
    assert "dotcom" in body["detail"]


# --- /stress/presets --------------------------------------------------------------


def test_stress_presets_lists_all_three_in_order():
    response = client.get("/stress/presets")

    assert response.status_code == 200
    ids = [preset["id"] for preset in response.json()["presets"]]
    assert ids == ["gfc_2008", "covid_2020", "rates_2022"]
