"""API-level protective limits (security audit F1/F2).

These are transport/abuse caps, NOT domain constants — they carry no
business meaning (that is what sentinel_core/constants.py is for), they
just bound what a single unauthenticated request may cost us. Raising
them is safe if the resource math still holds; see the audit notes.

Mirrored in frontend/lib/limits.ts (FRONTEND_DECISIONS.md §8) for
client-side UX checks — this file here remains the real defense, the
frontend copy only prevents doomed requests before they are sent.
Whoever changes one side changes the other.
"""

# Max tickers per portfolio/optimizer request. Caps both the covariance
# matrix size (n²) and the yfinance amplification (one small request
# must not trigger an arbitrarily large Yahoo download, F4).
MAX_PORTFOLIO_TICKERS = 50

# Max client-held transactions per paper/* request. Replay is O(n);
# 10k transactions replay in milliseconds but bound the payload.
MAX_TRANSACTIONS = 10_000

# Global request-body cap enforced by middleware in main.py (F1).
MAX_BODY_BYTES = 2_000_000

# CSV upload cap, enforced streaming (abort while reading, F2) —
# a portfolio CSV is a few KB; 1 MB is generous.
MAX_CSV_BYTES = 1_000_000
