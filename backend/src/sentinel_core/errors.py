"""Domain error base class (API_CONTRACT.md §1.1, security audit F7).

Every deliberate, user-facing domain error in sentinel_core is a
SentinelError with a German, speaking message — the API layer passes the
message through as `detail` and maps it to a stable `code` via the
fragment registry. Foreign ValueErrors (pandas/numpy/scipy internals)
are NOT SentinelErrors and therefore surface as a generic 500 instead of
leaking library text to users.

Subclassing ValueError keeps every existing `pytest.raises(ValueError)`
test valid.
"""

from __future__ import annotations


class SentinelError(ValueError):
    """Deliberate domain error with a user-ready German message."""
