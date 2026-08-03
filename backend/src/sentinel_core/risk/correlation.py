"""Pairwise return correlation between held positions (ARCHITECTURE.md §5/§6
addition: visual deepening of "why diversification" next to the
diversification ampel).

No weight vector is involved here (correlation is between assets, not a
portfolio scalar), so the usual `_aligned_weights` reindex does not apply.
The alignment concern is different but analogous: pandas' `.corr()` already
keys its result by column name, but the OUTPUT ORDER would otherwise mirror
whatever order the caller's returns/weights happened to be in. Ticker names
are therefore reindexed to a sorted order explicitly, so two callers who
pass the same tickers in different orders get byte-identical responses
(same invariant as CLAUDE.md rule 2, applied to output determinism instead
of a weight/covariance alignment). The column-shuffle test enforces this.
"""

from __future__ import annotations

import pandas as pd

from sentinel_core.errors import SentinelError


def correlation_matrix(returns: pd.DataFrame) -> dict:
    """NxN Pearson correlation of daily returns, keyed by sorted ticker names.

    Returns {"tickers": [...], "matrix": [[...], ...]} with
    matrix[i][j] == corr(tickers[i], tickers[j]); diagonal is always 1.0.
    Raises for fewer than two assets (analogous to the optimizer's
    "mindestens 2 Assets" rule — a single asset has no correlation to
    compute against).
    """
    tickers = sorted(str(c) for c in returns.columns)
    if len(tickers) < 2:
        raise SentinelError(
            "Die Korrelationsmatrix benötigt mindestens 2 Assets – für ein "
            "einzelnes Asset gibt es keine Korrelation zu berechnen."
        )
    aligned_returns = returns.reindex(columns=tickers)
    corr = aligned_returns.corr().reindex(index=tickers, columns=tickers)
    return {"tickers": tickers, "matrix": corr.to_numpy().tolist()}
