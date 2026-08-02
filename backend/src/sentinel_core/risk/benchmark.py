"""Benchmark identifier lookup for risk/benchmark-compare.

Mirrors sentinel_core.stress.replay.get_preset: a fixed, validated set
of options (constants.py BENCHMARK_TICKERS), never a free-form ticker —
the API layer composes the actual comparison via the existing
risk/metrics + risk/scoring functions, this module only resolves and
validates the identifier (ARCHITECTURE §1: core stays HTTP-free, but
input validation against a fixed domain list belongs here, not in the
API schema).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import BENCHMARK_TICKERS
from sentinel_core.errors import SentinelError


class Benchmark(BaseModel):
    """One fixed benchmark option (ETF proxy for a well-known index)."""

    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    ticker: str


def list_benchmarks() -> list[Benchmark]:
    return [
        Benchmark(id=benchmark_id, title=raw["title"], ticker=raw["ticker"])
        for benchmark_id, raw in BENCHMARK_TICKERS.items()
    ]


def get_benchmark(benchmark_id: str) -> Benchmark:
    if benchmark_id not in BENCHMARK_TICKERS:
        known = ", ".join(sorted(BENCHMARK_TICKERS))
        raise SentinelError(
            f"Unbekannter Vergleichsindex: '{benchmark_id}'. Verfügbar: {known}."
        )
    raw = BENCHMARK_TICKERS[benchmark_id]
    return Benchmark(id=benchmark_id, title=raw["title"], ticker=raw["ticker"])
