"""Historical crisis replay (STRESS_TEST_DECISIONS.md).

Orchestration only — no new portfolio math: prices come from the loader,
returns/drawdown/volatility from risk.metrics, texts from education.

Two load-bearing rules:

1. Assets without history at the window start are excluded BEFORE any
   return computation. daily_returns() truncates to the common history of
   all columns, so a late IPO would otherwise silently shrink the whole
   crisis window instead of being flagged.
2. Crisis windows are immutable, so prices are cached as CSV per
   (preset, ticker) with no TTL. Negative results (ticker has no data in
   the window) are cached as empty marker files; if a transient yfinance
   outage ever poisons such a marker, deleting the cache directory heals
   it — acceptable for Phase 1.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import (
    STRESS_MIN_COVERAGE,
    STRESS_PRESETS,
    STRESS_START_TOLERANCE_DAYS,
)
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.education.explanations import (
    STRESS_DISCLAIMER,
    STRESS_LESSONS,
    stress_explanation,
)
from sentinel_core.errors import SentinelError
from sentinel_core.risk.metrics import (
    daily_returns,
    max_drawdown,
    normalize_weights,
    portfolio_returns,
    portfolio_volatility,
)

# Absolute, anchored to this file's location — NOT to the process' CWD
# (security audit F5: "CWD-relativ bricht bei anderem Startverzeichnis",
# e.g. a deploy platform launching uvicorn from a different working
# directory than local dev). Resolves to backend/.cache/stress/v1.
# The API layer may override this per-request via STRESS_CACHE_DIR
# (sentinel_api/routers/stress.py) — core itself stays env-free.
DEFAULT_CACHE_DIR = Path(__file__).resolve().parents[3] / ".cache" / "stress" / "v1"


class ScenarioPreset(BaseModel):
    """One fixed crisis window (peak-to-trough, see constants.py)."""

    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    start: date
    end: date


class StressReplayResult(BaseModel):
    """Replay outcome: path, metrics, coverage and German texts."""

    model_config = ConfigDict(frozen=True)

    preset_id: str
    title: str
    start: date
    end: date
    # normalized portfolio value over the window, starting at 1.0
    dates: list[date]
    value_path: list[float]
    max_drawdown: float
    total_return: float
    volatility: float  # annualized, within the window
    coverage: float  # share of today's weights that was simulatable
    included_tickers: list[str]
    excluded_tickers: list[str]
    explanation: str
    lesson: str
    disclaimer: str


def get_preset(preset_id: str) -> ScenarioPreset:
    if preset_id not in STRESS_PRESETS:
        known = ", ".join(sorted(STRESS_PRESETS))
        raise SentinelError(
            f"Unbekanntes Krisen-Szenario: '{preset_id}'. Verfügbar: {known}."
        )
    raw = STRESS_PRESETS[preset_id]
    return ScenarioPreset(
        id=preset_id,
        title=raw["title"],
        start=date.fromisoformat(raw["start"]),
        end=date.fromisoformat(raw["end"]),
    )


def load_preset_prices(
    preset: ScenarioPreset, ticker: str, cache_dir: Path
) -> pd.Series | None:
    """Prices for one ticker in the window, file-cached forever.

    Returns None if the ticker has no data in the window (e.g. listed
    after the crisis) — that is a normal, expected outcome, not an error.
    """
    path = cache_dir / preset.id / f"{ticker}.csv"
    if path.exists():
        if path.stat().st_size == 0:
            return None
        frame = pd.read_csv(path, index_col=0, parse_dates=True)
        return frame[ticker]

    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        # yfinance treats `end` as exclusive — add one day so the trough
        # day itself is included.
        prices = load_multiple_assets(
            [ticker],
            start=preset.start.isoformat(),
            end=(preset.end + timedelta(days=1)).isoformat(),
        )
    except ValueError:
        path.touch()  # cache the negative result (empty marker file)
        return None
    prices.to_csv(path)
    return prices[ticker]


def replay(
    weights: dict[str, float],
    preset_id: str,
    cache_dir: Path = DEFAULT_CACHE_DIR,
) -> StressReplayResult:
    """Replay today's allocation through a historical crisis window.

    Constant weights over the whole window (same assumption as score and
    Ampel — see STRESS_TEST_DECISIONS.md §4).
    """
    preset = get_preset(preset_id)
    normalized = normalize_weights(weights)

    # Exclusion BEFORE return computation (rule 1 in the module docstring).
    window_start = pd.Timestamp(preset.start)
    latest_allowed_start = window_start + pd.tseries.offsets.BDay(
        STRESS_START_TOLERANCE_DAYS
    )
    included: dict[str, pd.Series] = {}
    excluded: list[str] = []
    for ticker in normalized.index:
        series = load_preset_prices(preset, ticker, cache_dir)
        first_valid = series.first_valid_index() if series is not None else None
        if first_valid is None or first_valid > latest_allowed_start:
            excluded.append(ticker)
        else:
            included[ticker] = series

    coverage = float(normalized[list(included)].sum()) if included else 0.0
    if coverage < STRESS_MIN_COVERAGE:
        raise SentinelError(
            f"Szenario '{preset.title}' ist für dieses Depot nicht "
            f"aussagekräftig: Nur {coverage * 100:.0f} % des Depotgewichts "
            f"waren im Zeitraum bereits handelbar (Minimum: "
            f"{STRESS_MIN_COVERAGE * 100:.0f} %). Nicht verfügbar: "
            f"{', '.join(sorted(excluded))}."
        )

    # normalize_weights inside the metrics renormalizes the included
    # subset to 1.0 — the documented exclusion semantics.
    included_weights = {t: float(normalized[t]) for t in included}
    prices = pd.DataFrame(included)
    returns = daily_returns(prices)
    port_returns = portfolio_returns(included_weights, returns)

    path = (1 + port_returns).cumprod()
    start_point = pd.Series([1.0], index=[prices.index[0]])
    path = pd.concat([start_point, path])

    mdd = max_drawdown(port_returns)
    total_return = float(path.iloc[-1] - 1)
    explanation = stress_explanation(
        title=preset.title,
        max_dd=mdd,
        total_return=total_return,
        coverage=coverage,
        excluded=sorted(excluded),
    )

    return StressReplayResult(
        preset_id=preset.id,
        title=preset.title,
        start=preset.start,
        end=preset.end,
        dates=[ts.date() for ts in path.index],
        value_path=[float(v) for v in path],
        max_drawdown=mdd,
        total_return=total_return,
        volatility=portfolio_volatility(included_weights, returns),
        coverage=coverage,
        included_tickers=sorted(included),
        excluded_tickers=sorted(excluded),
        explanation=explanation,
        lesson=STRESS_LESSONS[preset.id],
        disclaimer=STRESS_DISCLAIMER,
    )
