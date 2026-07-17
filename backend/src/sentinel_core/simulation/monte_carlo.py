"""Monte Carlo future simulation (MONTE_CARLO_DECISIONS.md).

Historical bootstrap on the PORTFOLIO return series: with constant
weights (the same assumption score, Ampel and stress replay use),
drawing whole trading days from the portfolio series preserves the asset
correlation structure exactly. Resampling assets independently would
destroy it and produce an unrealistically narrow fan — the one mistake
this module must never make (decision doc §2).

Deterministic by design: fixed seed from constants, same input -> same
fan. The transparency fields (history_days, limiting_ticker,
recycling_factor) are derived from EXACTLY the returns being simulated —
never from a second, independent data query.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict

from sentinel_core.constants import (
    SIM_HORIZONS_YEARS,
    SIM_MIN_HISTORY_DAYS,
    SIM_N_PATHS,
    SIM_SEED,
    SIM_SUPPORT_STEP_DAYS,
    SIM_THIN_HISTORY_YEARS,
    TRADING_DAYS,
)
from sentinel_core.data.loader import load_multiple_assets
from sentinel_core.education.explanations import (
    SIM_DISCLAIMER,
    SIM_LESSON,
    simulation_explanation,
)
from sentinel_core.errors import SentinelError
from sentinel_core.risk.metrics import portfolio_returns

# History window for the internally loaded price basis (~5 trading years).
_HISTORY_PERIOD = "5y"


class MonteCarloResult(BaseModel):
    """Percentile fan with mandatory data-basis transparency."""

    model_config = ConfigDict(frozen=True)

    horizon_years: int
    n_paths: int
    seed: int

    # fan, normalized to 1.0 today; parallel lists at ~monthly support
    # points given as trading-day offsets
    trading_days: list[int]
    p10: list[float]
    p50: list[float]
    p90: list[float]

    final_p10: float
    final_p50: float
    final_p90: float

    # data-basis transparency (decision doc §6 + recycling addition)
    history_days: int
    history_years: float
    limiting_ticker: str | None
    recycling_factor: float  # horizon trading days / history_days
    thin_history: bool

    explanation: str
    lesson: str
    disclaimer: str


def simulate(
    weights: dict[str, float],
    horizon_years: int,
    returns: pd.DataFrame | None = None,
) -> MonteCarloResult:
    """Bootstrap fan for today's allocation over a fixed horizon.

    `returns` may be injected (tests / precomputed data) and may contain
    leading NaN for younger assets; otherwise up to ~5 years of daily
    prices are loaded. Either way the SAME frame drives both the
    simulation and the transparency fields.
    """
    if horizon_years not in SIM_HORIZONS_YEARS:
        allowed = ", ".join(str(y) for y in SIM_HORIZONS_YEARS)
        raise SentinelError(
            f"Zeithorizont muss {allowed} Jahre sein ({horizon_years})."
        )

    if returns is None:
        prices = load_multiple_assets(list(weights), period=_HISTORY_PERIOD)
        # Same convention as metrics.daily_returns, but the truncation to
        # the common history happens in _common_history below — otherwise
        # the limiting ticker would no longer be identifiable.
        returns = prices.pct_change(fill_method=None)

    clean, limiting_ticker = _common_history(returns)
    history_days = len(clean)
    if history_days < SIM_MIN_HISTORY_DAYS:
        raise SentinelError(
            f"Zu wenig Kurshistorie für eine aussagekräftige Simulation: "
            f"{history_days} gemeinsame Handelstage, mindestens "
            f"{SIM_MIN_HISTORY_DAYS} erforderlich"
            + (f" (begrenzt durch {limiting_ticker})" if limiting_ticker else "")
            + "."
        )

    daily = portfolio_returns(weights, clean).to_numpy()

    horizon_days = horizon_years * TRADING_DAYS
    rng = np.random.default_rng(SIM_SEED)
    samples = rng.choice(daily, size=(SIM_N_PATHS, horizon_days), replace=True)
    paths = np.cumprod(1.0 + samples, axis=1)

    support = list(range(SIM_SUPPORT_STEP_DAYS, horizon_days, SIM_SUPPORT_STEP_DAYS))
    support.append(horizon_days)
    percentiles = np.percentile(
        paths[:, [d - 1 for d in support]], [10, 50, 90], axis=0
    )

    trading_day_points = [0, *support]
    p10 = [1.0, *(float(v) for v in percentiles[0])]
    p50 = [1.0, *(float(v) for v in percentiles[1])]
    p90 = [1.0, *(float(v) for v in percentiles[2])]

    history_years = history_days / TRADING_DAYS
    recycling_factor = horizon_days / history_days
    thin_history = history_years < SIM_THIN_HISTORY_YEARS

    explanation = simulation_explanation(
        horizon_years=horizon_years,
        final_p10=p10[-1],
        final_p50=p50[-1],
        final_p90=p90[-1],
        history_years=history_years,
        limiting_ticker=limiting_ticker,
        recycling_factor=recycling_factor,
        thin_history=thin_history,
    )

    return MonteCarloResult(
        horizon_years=horizon_years,
        n_paths=SIM_N_PATHS,
        seed=SIM_SEED,
        trading_days=trading_day_points,
        p10=p10,
        p50=p50,
        p90=p90,
        final_p10=p10[-1],
        final_p50=p50[-1],
        final_p90=p90[-1],
        history_days=history_days,
        history_years=history_years,
        limiting_ticker=limiting_ticker,
        recycling_factor=recycling_factor,
        thin_history=thin_history,
        explanation=explanation,
        lesson=SIM_LESSON,
        disclaimer=SIM_DISCLAIMER,
    )


def _common_history(returns: pd.DataFrame) -> tuple[pd.DataFrame, str | None]:
    """Truncate to the common history and name what limits it.

    Both answers come from the SAME frame that is subsequently simulated
    (no second data source). The limiting ticker is None when all
    columns reach equally far back.
    """
    first_dates = {}
    for column in returns.columns:
        first_valid = returns[column].first_valid_index()
        if first_valid is None:
            raise SentinelError(f"Keine Renditedaten für Ticker: {column}.")
        first_dates[column] = first_valid

    latest_start = max(first_dates.values())
    if latest_start > min(first_dates.values()):
        limiting = sorted(c for c, d in first_dates.items() if d == latest_start)
        limiting_ticker = ", ".join(limiting)
    else:
        limiting_ticker = None
    return returns.dropna(), limiting_ticker
