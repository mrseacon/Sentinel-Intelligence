"""Historical Value at Risk / Conditional VaR (KNOWLEDGE_EXTRACTION.md §4).

Sign convention: both are returned as NEGATIVE values in return space
(loss = negative), not as positive loss magnitudes. Downstream consumers
(scoring) apply abs(). The tail is defined INCLUSIVELY (<= VaR), and an
empty tail falls back to the VaR itself instead of propagating the NaN of
an empty mean — both are deliberate legacy decisions, do not "fix" them.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from sentinel_core.constants import VAR_CONFIDENCE


def historical_var(returns: pd.Series, confidence: float = VAR_CONFIDENCE) -> float:
    """Historical VaR: the (1 - confidence) percentile of daily returns."""
    if returns.empty:
        raise ValueError("Keine Renditedaten für die VaR-Berechnung.")
    if not 0 < confidence < 1:
        raise ValueError(
            f"Konfidenzniveau muss zwischen 0 und 1 liegen ({confidence})."
        )
    return float(np.percentile(returns, (1 - confidence) * 100))


def historical_cvar(returns: pd.Series, confidence: float = VAR_CONFIDENCE) -> float:
    """Historical CVaR: mean of the tail returns at or below the VaR.

    Invariant: CVaR <= VaR (the tail mean is at least as bad as the
    threshold). Empty tail -> VaR fallback (§4).
    """
    var = historical_var(returns, confidence)
    tail = returns[returns <= var]
    if tail.empty:
        return var
    return float(tail.mean())
