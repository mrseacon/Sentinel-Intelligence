"""Minimal per-IP rate limiting (security audit F9, ARCHITECTURE §8).

Purpose: protect OUR outbound Yahoo IP from amplification (one cheap
request -> a Yahoo download), not to meter users. Hence a single generous
sliding-window limit per client IP, in memory, no external store.

Deliberately hand-rolled instead of slowapi: ~60 lines of pure ASGI, zero
extra dependencies (slowapi drags in limits/wrapt/opentelemetry), and no
decorator wiring per route. In-memory state is per process — correct for
the single-instance free-tier deploy; with several workers the effective
limit multiplies (acceptable for an abuse guard, see HANDOVER.md).
"""

from __future__ import annotations

import json
import math
import time
from collections import deque
from collections.abc import Callable

from starlette.types import ASGIApp, Receive, Scope, Send

# Above this many tracked IPs, stale entries are swept so a scan from
# many addresses cannot grow the dict without bound.
_SWEEP_THRESHOLD = 10_000


def client_ip(scope: Scope) -> str:
    """Rightmost X-Forwarded-For entry, else the socket peer.

    Behind Render/Railway the socket peer is the platform proxy, so every
    user would share one bucket. The proxy APPENDS the real client IP to
    X-Forwarded-For; the rightmost entry is therefore the only one a
    client cannot forge. Without a proxy (local dev) the header is absent
    and the peer address is used.
    """
    for name, value in scope["headers"]:
        if name == b"x-forwarded-for":
            last = value.decode("latin-1").split(",")[-1].strip()
            if last:
                return last
    client = scope.get("client")
    return client[0] if client else "unknown"


class RateLimitMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        limit: int,
        window_seconds: float = 60.0,
        exempt_paths: tuple[str, ...] = ("/health",),
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app = app
        self.limit = limit
        self.window = window_seconds
        self.exempt_paths = exempt_paths
        self.clock = clock
        self._hits: dict[str, deque[float]] = {}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Preflights are answered by CORSMiddleware (outermost) anyway;
        # the OPTIONS bypass is just belt and braces.
        if (
            scope["type"] != "http"
            or scope["method"] == "OPTIONS"
            or scope["path"] in self.exempt_paths
        ):
            await self.app(scope, receive, send)
            return

        retry_after = self._check(client_ip(scope))
        if retry_after is None:
            await self.app(scope, receive, send)
            return

        body = json.dumps(
            {
                "detail": (
                    "Zu viele Anfragen. Bitte warte einen Moment und versuche es "
                    "dann erneut."
                ),
                "code": "RATE_LIMITED",
            }
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"retry-after", str(retry_after).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    def _check(self, key: str) -> int | None:
        """Record a hit; return Retry-After seconds if over the limit."""
        now = self.clock()
        if len(self._hits) > _SWEEP_THRESHOLD:
            self._sweep(now)
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return max(1, math.ceil(self.window - (now - hits[0])))
        hits.append(now)
        return None

    def _sweep(self, now: float) -> None:
        stale = [
            k for k, h in self._hits.items() if not h or now - h[-1] >= self.window
        ]
        for k in stale:
            del self._hits[k]
