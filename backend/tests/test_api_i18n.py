"""API tests for the optional `lang` parameter (API_CONTRACT.md §1.4):
every text endpoint answers in English with lang="en", stays German
without it (backwards compatible), and an unknown language gives the
contract error LANG_UNSUPPORTED. yfinance and RSS are mocked like
everywhere else in the suite.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import test_api_benchmark
import test_api_reports
from sentinel_api.main import app
from test_ai import patch_feeds, rss
from test_api_risk import WEIGHTS, price_frame_from_returns
from test_api_simulation import synthetic_prices
from test_i18n import GERMAN_MARKERS
from test_loader import patch_download
from test_risk_metrics import sample_returns
from test_stress import GFC_WINDOW, declining_series, fake_market

client = TestClient(app)


def assert_english(text: str) -> None:
    assert text
    marker = GERMAN_MARKERS.search(text)
    assert marker is None, f"German '{marker.group(0)}' in: {text}"


def test_ampel_lang_en_returns_english_texts(monkeypatch):
    patch_download(monkeypatch, price_frame_from_returns(sample_returns()))
    payload = {"portfolio": {"weights": WEIGHTS}}

    de = client.post("/risk/ampel", json=payload).json()["ampeln"]
    en = client.post("/risk/ampel", json={**payload, "lang": "en"}).json()["ampeln"]

    assert [a["title"] for a in de] == [
        "Klumpenrisiko",
        "Diversifikation",
        "Volatilität",
    ]
    assert [a["title"] for a in en] == [
        "Concentration risk",
        "Diversification",
        "Volatility",
    ]
    for de_light, en_light in zip(de, en, strict=True):
        assert de_light["status"] == en_light["status"]
        assert de_light["value"] == en_light["value"]
        for field in ("explanation", "lesson"):
            assert de_light[field] != en_light[field]
            assert_english(en_light[field])


def test_stress_replay_and_presets_lang_en(monkeypatch):
    fake_market(monkeypatch, {"OLD1": declining_series(GFC_WINDOW)})
    body = client.post(
        "/stress/replay",
        json={
            "portfolio": {"weights": {"OLD1": 1.0}},
            "preset_id": "gfc_2008",
            "lang": "en",
        },
    ).json()
    assert body["title"] == "Financial crisis 2008/09"
    for field in ("explanation", "lesson", "disclaimer"):
        assert_english(body[field])

    presets_en = client.get("/stress/presets", params={"lang": "en"}).json()["presets"]
    presets_de = client.get("/stress/presets").json()["presets"]
    assert [p["id"] for p in presets_en] == [p["id"] for p in presets_de]
    assert presets_de[0]["title"] == "Finanzkrise 2008/09"
    for preset in presets_en:
        assert_english(preset["title"])


def test_monte_carlo_lang_en(monkeypatch):
    patch_download(monkeypatch, synthetic_prices(400, ["AAPL", "MSFT"]))
    payload = {"portfolio": {"weights": {"AAPL": 0.6, "MSFT": 0.4}}, "horizon_years": 5}

    de = client.post("/simulation/monte-carlo", json=payload).json()
    en = client.post("/simulation/monte-carlo", json={**payload, "lang": "en"}).json()

    assert de["p50"] == en["p50"]
    assert "Verläufen" in de["explanation"]
    for field in ("explanation", "lesson", "disclaimer"):
        assert_english(en[field])


def test_benchmark_compare_lang_en(monkeypatch):
    monkeypatch.setattr(
        test_api_benchmark.loader.yf, "download", test_api_benchmark._fake_download
    )
    body = client.post(
        "/risk/benchmark-compare",
        json={
            "portfolio": {"weights": test_api_benchmark.WEIGHTS},
            "benchmark_id": "msci_world",
            "lang": "en",
        },
    ).json()
    assert body["benchmark_title"] == "MSCI World (URTH)"
    assert body["comparison"].startswith("Your portfolio")
    assert_english(body["comparison"])

    # proper names: identical titles, lang still validated
    assert client.get("/risk/benchmarks", params={"lang": "en"}).status_code == 200


def test_optimize_disclaimer_lang_en(monkeypatch):
    patch_download(
        monkeypatch, price_frame_from_returns(sample_returns(["AAPL", "MSFT"]))
    )
    payload = {"tickers": ["AAPL", "MSFT"]}
    de = client.post("/portfolio/optimize", json=payload).json()
    en = client.post("/portfolio/optimize", json={**payload, "lang": "en"}).json()
    assert de["weights"] == en["weights"]
    assert "Keine Empfehlung" in de["disclaimer"]
    assert "Not a recommendation" in en["disclaimer"]


def test_report_lang_en_has_english_filename(monkeypatch):
    test_api_reports._patch_market(monkeypatch)
    response = client.post(
        "/reports/risk-summary",
        json={"portfolio": {"weights": test_api_reports.WEIGHTS}, "lang": "en"},
    )
    assert response.status_code == 200
    assert response.content[:5] == b"%PDF-"
    assert "sentinel-risk-report-" in response.headers["content-disposition"]

    default = client.post(
        "/reports/risk-summary",
        json={"portfolio": {"weights": test_api_reports.WEIGHTS}},
    )
    assert "sentinel-risiko-report-" in default.headers["content-disposition"]


@pytest.mark.parametrize(
    ("lang", "edition", "query_word"),
    [("de", "hl=de&gl=DE", "Aktie"), ("en", "hl=en-US&gl=US", "stock")],
)
def test_news_edition_follows_lang(monkeypatch, lang, edition, query_word):
    urls, _ = patch_feeds(monkeypatch, {"NVDA": rss("NVDA headline - Source")})
    response = client.get("/news/headlines", params={"ticker": "NVDA", "lang": lang})
    assert response.status_code == 200
    assert len(urls) == 1
    assert edition in urls[0]
    assert query_word in urls[0]


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("post", "/risk/ampel", {"portfolio": {"weights": {"AAPL": 1.0}}}),
        (
            "post",
            "/stress/replay",
            {"portfolio": {"weights": {"AAPL": 1.0}}, "preset_id": "gfc_2008"},
        ),
        (
            "post",
            "/simulation/monte-carlo",
            {"portfolio": {"weights": {"AAPL": 1.0}}, "horizon_years": 1},
        ),
        (
            "post",
            "/risk/benchmark-compare",
            {"portfolio": {"weights": {"AAPL": 1.0}}, "benchmark_id": "sp500"},
        ),
        ("post", "/portfolio/optimize", {"tickers": ["AAPL", "MSFT"]}),
        ("post", "/reports/risk-summary", {"portfolio": {"weights": {"AAPL": 1.0}}}),
    ],
)
def test_unknown_lang_in_body_gives_contract_error(method, path, payload):
    # Validated BEFORE any price data is loaded: no market mock needed.
    response = getattr(client, method)(path, json={**payload, "lang": "fr"})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "LANG_UNSUPPORTED"
    assert "fr" in body["detail"]


@pytest.mark.parametrize(
    "path", ["/stress/presets", "/risk/benchmarks", "/news/headlines?ticker=NVDA"]
)
def test_unknown_lang_in_query_gives_contract_error(path):
    separator = "&" if "?" in path else "?"
    response = client.get(f"{path}{separator}lang=xx")
    assert response.status_code == 422
    assert response.json()["code"] == "LANG_UNSUPPORTED"
