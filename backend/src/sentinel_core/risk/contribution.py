"""Variance-based risk contribution (KNOWLEDGE_EXTRACTION.md §12).

Contribution of asset i is w_i * (Σw)_i / (wᵀΣw); the contributions sum
to 1 (relative shares). Daily covariance suffices — annualization cancels
out. The "weight vs. risk contribution" comparison is the actual product:
it shows that capital weight != risk weight.
"""

from __future__ import annotations

import pandas as pd

from sentinel_core.risk.metrics import _aligned_weights


def risk_contribution(weights: dict[str, float], returns: pd.DataFrame) -> pd.Series:
    """Relative risk contribution per ticker, summing to 1.

    Alignment by ticker name via reindex, like every other entry point
    (§3) — the column-shuffle test guards this.
    """
    aligned = _aligned_weights(weights, returns)
    covariance = returns.cov()
    marginal = covariance @ aligned
    portfolio_variance = float(aligned @ marginal)
    if portfolio_variance == 0:
        raise ValueError(
            "Portfolio-Varianz ist 0 – Risikobeiträge sind nicht definiert."
        )
    return aligned * marginal / portfolio_variance
