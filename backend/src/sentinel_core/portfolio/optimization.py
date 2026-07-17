"""Max-Sharpe portfolio optimization (KNOWLEDGE_EXTRACTION.md §11).

Constraints are domain decisions, ported unchanged:
- long-only (lower bound 0) and full investment (sum of weights = 1),
- per-asset cap OPTIMIZER_MAX_WEIGHT from constants.py — without it
  max-Sharpe tends to put everything into a single asset,
- SLSQP with equal weighting as start, risk-free rate 0 (not documented
  in the legacy project; deliberate simplification, see session log).

Mean vector and covariance both come from the same returns frame, so
weights are keyed by ticker name by construction — the column-shuffle
test guards that permuted inputs yield permuted-identical results.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict
from scipy.optimize import minimize

from sentinel_core.constants import OPTIMIZER_MAX_WEIGHT, TRADING_DAYS
from sentinel_core.errors import SentinelError
from sentinel_core.risk.metrics import portfolio_returns, portfolio_volatility

# Penalty for degenerate weights with zero portfolio volatility — SLSQP
# probes such points and must not crash on division by zero (§11).
_ZERO_VOL_PENALTY = 1e6


class OptimizationResult(BaseModel):
    """Optimized allocation with its annualized characteristics."""

    model_config = ConfigDict(frozen=True)

    weights: dict[str, float]
    expected_return: float
    volatility: float
    sharpe: float


def optimize_max_sharpe(returns: pd.DataFrame) -> OptimizationResult:
    """Find the long-only max-Sharpe allocation for the given returns.

    Raises ValueError (German, user-facing) for fewer than two assets,
    too little history, or a solver that does not converge.
    """
    tickers = [str(c) for c in returns.columns]
    if len(tickers) < 2:
        raise SentinelError(
            "Die Optimierung benötigt mindestens 2 Assets – für ein "
            "einzelnes Asset gibt es nichts zu gewichten."
        )
    if len(returns) < 2:
        raise SentinelError(
            "Zu wenige Datenpunkte für die Optimierung: mindestens 2 "
            "Renditebeobachtungen werden benötigt."
        )
    # NaN gaps (e.g. unequal histories passed without daily_returns())
    # would surface as a cryptic solver abort — reject them up front.
    if returns.isna().any().any():
        gapped = [str(c) for c in returns.columns[returns.isna().any()]]
        raise SentinelError(
            f"Die Renditedaten enthalten Lücken (NaN) in: {', '.join(gapped)}. "
            "Vor der Optimierung auf die gemeinsame Historie zuschneiden "
            "(daily_returns)."
        )

    mean_daily = returns.mean().to_numpy()
    cov_daily = returns.cov().to_numpy()

    def negative_sharpe(weights: np.ndarray) -> float:
        # Annualization inside the objective does not change the argmin
        # but keeps intermediate Sharpe values interpretable (§11).
        annual_return = float(weights @ mean_daily) * TRADING_DAYS
        annual_vol = float(np.sqrt(weights @ cov_daily @ weights)) * float(
            np.sqrt(TRADING_DAYS)
        )
        if annual_vol == 0:
            return _ZERO_VOL_PENALTY
        return -annual_return / annual_vol

    n_assets = len(tickers)
    start = np.full(n_assets, 1 / n_assets)
    bounds = [(0.0, OPTIMIZER_MAX_WEIGHT)] * n_assets
    constraints = [{"type": "eq", "fun": lambda w: float(np.sum(w)) - 1.0}]

    result = minimize(
        negative_sharpe,
        start,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
    )
    if not result.success:
        raise SentinelError(
            "Die Portfolio-Optimierung ist nicht konvergiert "
            f"(Solver-Meldung: {result.message}). Prüfe die Eingabedaten, "
            "z.B. ob die Kurshistorie lang genug ist."
        )

    # Solver noise can leave tiny negatives; clean and renormalize
    # defensively before handing the weights out.
    cleaned = np.clip(result.x, 0.0, None)
    cleaned = cleaned / cleaned.sum()
    weights = {t: float(w) for t, w in zip(tickers, cleaned, strict=True)}

    expected_return = float(portfolio_returns(weights, returns).mean()) * TRADING_DAYS
    volatility = portfolio_volatility(weights, returns)
    # Degenerate inputs (constant prices everywhere) can "converge" at
    # (numerically almost) zero volatility; Sharpe is undefined there —
    # fail speaking instead of with a ZeroDivisionError or a nonsense
    # Sharpe in the quintillions. Tolerance because float rounding keeps
    # the variance of constant series slightly above exact zero.
    if volatility < 1e-12:
        raise SentinelError(
            "Die Renditedaten sind degeneriert (Portfolio-Volatilität 0, "
            "z.B. konstante Kurse) – eine Sharpe-Optimierung ist damit "
            "nicht definiert."
        )
    return OptimizationResult(
        weights=weights,
        expected_return=expected_return,
        volatility=volatility,
        sharpe=expected_return / volatility,
    )
