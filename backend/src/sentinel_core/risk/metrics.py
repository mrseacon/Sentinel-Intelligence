"""Portfolio risk metrics (KNOWLEDGE_EXTRACTION.md §2, §3, §6, §12).

Two hard rules from the legacy project apply everywhere here:

1. Weights and covariance are aligned EXPLICITLY by ticker name (reindex),
   never by dict insertion or column order. The legacy code relied on an
   invisible ordering invariant and produced silently wrong numbers when
   either side changed (§3). The column-shuffle test enforcing this must
   never be removed (CLAUDE.md rule 2).
2. Weights are defensively renormalized at every entry point — callers may
   pass euro amounts, share counts or unnormalized fractions (§10).

Conventions: simple returns (pct_change), sample std (ddof=1), volatility
annualized with sqrt(TRADING_DAYS).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from sentinel_core.constants import TRADING_DAYS


def normalize_weights(weights: dict[str, float]) -> pd.Series:
    """Defensive renormalization: accepts any positive scale (euros, shares).

    Raises ValueError for negative weights or a non-positive sum — both are
    input errors, not something to silently repair.
    """
    series = pd.Series(weights, dtype=float)
    if series.empty:
        raise ValueError("Keine Gewichte angegeben: das Portfolio ist leer.")
    negative = series[series < 0]
    if not negative.empty:
        raise ValueError(
            f"Negative Gewichte sind nicht erlaubt: {', '.join(negative.index)}."
        )
    total = series.sum()
    if total <= 0:
        raise ValueError("Die Summe der Gewichte muss größer als 0 sein.")
    return series / total


def daily_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Simple daily returns (pct_change), like the legacy project (§2).

    dropna() truncates to the common history of all assets — covariance
    math needs jointly observed returns.
    """
    return prices.pct_change(fill_method=None).dropna()


def portfolio_returns(weights: dict[str, float], returns: pd.DataFrame) -> pd.Series:
    """Daily portfolio returns as a weighted sum of asset returns.

    Same explicit name alignment as every other entry point (§3): the
    weights are reindexed to the return columns, never matched by order.
    """
    aligned = _aligned_weights(weights, returns)
    return returns @ aligned


def max_drawdown(returns: pd.Series) -> float:
    """Maximum peak-to-trough drawdown of a return series.

    Returned as a negative value in return space (loss = negative), like
    VaR/CVaR — downstream consumers use abs().
    """
    if returns.empty:
        raise ValueError("Keine Renditedaten für die Drawdown-Berechnung.")
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = cumulative / running_max - 1
    return float(drawdown.min())


def herfindahl_index(weights: dict[str, float]) -> float:
    """Concentration in (0, 1]; 1/N for equal weights.

    Self-normalizing by design (§6) — does not trust callers to pass
    normalized weights.
    """
    normalized = normalize_weights(weights)
    return float((normalized**2).sum())


def portfolio_volatility(weights: dict[str, float], returns: pd.DataFrame) -> float:
    """Annualized portfolio volatility from daily returns.

    Alignment is by ticker name via reindex — column order of `returns`
    must never matter (§3).
    """
    aligned = _aligned_weights(weights, returns)
    covariance = returns.cov()
    daily_variance = float(aligned @ covariance @ aligned)
    return float(np.sqrt(daily_variance) * np.sqrt(TRADING_DAYS))


def diversification_ratio(weights: dict[str, float], returns: pd.DataFrame) -> float:
    """Weighted average single-asset vol / portfolio vol, daily basis (§12).

    Scale-invariant, so no annualization needed. Values > 1 mean
    diversification is working.
    """
    aligned = _aligned_weights(weights, returns)
    single_vols = returns.std(ddof=1)
    weighted_avg_vol = float((aligned * single_vols).sum())
    portfolio_vol = float(np.sqrt(aligned @ returns.cov() @ aligned))
    if portfolio_vol == 0:
        raise ValueError(
            "Portfolio-Volatilität ist 0 – Diversification Ratio ist "
            "nicht definiert."
        )
    return weighted_avg_vol / portfolio_vol


def _aligned_weights(weights: dict[str, float], returns: pd.DataFrame) -> pd.Series:
    """Normalize and align weights to the return columns BY NAME.

    Tickers without return data are a hard error (named explicitly);
    return columns without a weight get weight 0.
    """
    normalized = normalize_weights(weights)
    missing = [t for t in normalized.index if t not in returns.columns]
    if missing:
        raise ValueError(f"Keine Renditedaten für Ticker: {', '.join(missing)}.")
    return normalized.reindex(returns.columns).fillna(0.0)
