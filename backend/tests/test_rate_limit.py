"""Rate limiting (security audit F9): per-IP sliding window, uniform
{detail, code} 429, health/preflight exempt, X-Forwarded-For handling."""

import importlib

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sentinel_api.rate_limit import RateLimitMiddleware


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def make_client(limit: int = 3, clock: FakeClock | None = None) -> TestClient:
    app = FastAPI()
    app.add_middleware(
        RateLimitMiddleware,
        limit=limit,
        window_seconds=60.0,
        clock=clock or FakeClock(),
    )

    @app.get("/ping")
    def ping() -> dict[str, str]:
        return {"ok": "yes"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return TestClient(app)


def test_requests_over_limit_get_429_with_contract_body():
    client = make_client(limit=3)
    assert [client.get("/ping").status_code for _ in range(3)] == [200, 200, 200]

    blocked = client.get("/ping")
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "RATE_LIMITED"
    assert "Zu viele Anfragen" in blocked.json()["detail"]
    assert int(blocked.headers["retry-after"]) >= 1


def test_window_slides_so_requests_pass_again_later():
    clock = FakeClock()
    client = make_client(limit=2, clock=clock)
    client.get("/ping")
    client.get("/ping")
    assert client.get("/ping").status_code == 429

    clock.now += 61
    assert client.get("/ping").status_code == 200


def test_health_is_exempt():
    client = make_client(limit=1)
    assert all(client.get("/health").status_code == 200 for _ in range(5))


def test_limit_is_tracked_per_client_ip_via_forwarded_for():
    client = make_client(limit=1)
    a = {"X-Forwarded-For": "203.0.113.1"}
    b = {"X-Forwarded-For": "203.0.113.2"}
    assert client.get("/ping", headers=a).status_code == 200
    assert client.get("/ping", headers=a).status_code == 429
    assert client.get("/ping", headers=b).status_code == 200


def test_forged_leading_forwarded_for_entries_do_not_evade_the_limit():
    # Only the rightmost entry (appended by our trusted proxy) counts.
    client = make_client(limit=1)
    assert client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1, 9.9.9.9"})
    resp = client.get("/ping", headers={"X-Forwarded-For": "2.2.2.2, 9.9.9.9"})
    assert resp.status_code == 429


def test_preflight_is_never_counted():
    client = make_client(limit=1)
    for _ in range(5):
        client.options("/ping")
    assert client.get("/ping").status_code == 200


def test_main_app_enables_limiter_from_env(monkeypatch):
    import sentinel_api.main as main_module

    monkeypatch.setenv("SENTINEL_RATE_LIMIT_PER_MINUTE", "2")
    reloaded = importlib.reload(main_module)
    try:
        client = TestClient(reloaded.app)
        statuses = [client.get("/docs").status_code for _ in range(3)]
        assert statuses[-1] == 429
        # /health stays reachable so platform health checks never trip it
        assert client.get("/health").status_code == 200
    finally:
        monkeypatch.setenv("SENTINEL_RATE_LIMIT_PER_MINUTE", "0")
        importlib.reload(main_module)
