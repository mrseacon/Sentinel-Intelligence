"""Locale-dependent number and date formatting for generated texts.

Mirrors the frontend's Intl-based helpers (frontend/lib/i18n/format.ts:
de-DE vs. en-US): German "1.234,5 %" with a space before the percent
sign, English "1,234.5%" without one.
"""

from __future__ import annotations

from datetime import date

from sentinel_core.i18n import Lang

_DE_SEPARATORS = str.maketrans({",": ".", ".": ","})


def num(value: float, lang: Lang, digits: int = 2) -> str:
    """1234.5 -> '1.234,50' (de) / '1,234.50' (en)."""
    text = f"{value:,.{digits}f}"
    return text.translate(_DE_SEPARATORS) if lang == "de" else text


def pct(share: float, lang: Lang, digits: int = 0) -> str:
    """0.42 -> '42 %' (de) / '42%' (en)."""
    value = num(share * 100, lang, digits)
    return f"{value} %" if lang == "de" else f"{value}%"


def day(value: date, lang: Lang) -> str:
    """2007-10-09 -> '09.10.2007' (de) / '10/09/2007' (en)."""
    return value.strftime("%d.%m.%Y" if lang == "de" else "%m/%d/%Y")
