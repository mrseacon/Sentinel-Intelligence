"""Locale support for user-facing texts (I18N_DECISIONS.md §2, way a).

One structured source of truth for every backend-generated sentence:
`catalog.py` holds the templates per language, `format.py` the number
and date formatting per language. Branching logic (status thresholds,
plural, optional clauses) stays ONCE in the callers (education/
explanations.py etc.) — only the wording is looked up here, so the two
languages can never drift apart in logic, only in phrasing.

Error messages (SentinelError) deliberately stay German: the API maps
them to stable `code`s via a fragment registry and the frontend
localizes by `code` (API_CONTRACT.md §1.1).
"""

from __future__ import annotations

from typing import Literal, get_args

from sentinel_core.errors import SentinelError

Lang = Literal["de", "en"]
SUPPORTED_LANGS: tuple[Lang, ...] = get_args(Lang)
DEFAULT_LANG: Lang = "de"


def resolve_lang(value: str) -> Lang:
    """Validate a requested language against the fixed list.

    Same pattern as get_preset/get_benchmark: validation against a fixed
    domain list lives in core and raises a SentinelError, which the API
    maps to its own code (LANG_UNSUPPORTED).
    """
    if value not in SUPPORTED_LANGS:
        raise SentinelError(
            f"Nicht unterstützte Sprache: '{value}'. "
            f"Verfügbar: {', '.join(SUPPORTED_LANGS)}."
        )
    return value  # type: ignore[return-value]
