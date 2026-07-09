"""CSV portfolio upload validation (KNOWLEDGE_EXTRACTION.md §10).

Format validation ONLY: whether tickers actually exist at Yahoo is
checked downstream by the loader (which rejects missing tickers by
name). Division of labour: upload = format, loader = existence — no
duplicate yfinance round trip in the upload path.

Rules ported unchanged from §10:
- required columns "ticker"/"weight", found by NAME after strip/lower
  normalization (never by position; " Ticker "/"WEIGHT" must work),
- ticker values strip/upper; empty tickers, negative weights and a
  non-positive weight sum are hard errors,
- weights via to_numeric(errors="raise"), no silent NaN swallowing,
- weights need NOT sum to 1 (euro amounts / share counts are fine;
  normalization is a separate downstream step -> PortfolioIn contract),
- duplicate tickers are ALLOWED and aggregated by sum (tested legacy
  behaviour).

Own decisions beyond §10 (not documented there):
- encoding utf-8-sig with cp1252 fallback (Excel exports carry a BOM;
  German Excel often writes cp1252 — payload is ASCII, so the
  single-byte fallback is safe),
- delimiter auto-detection comma vs. semicolon, paired with decimal
  comma for semicolon files (German Excel default: ';' + '0,5').
"""

from __future__ import annotations

import io

import pandas as pd

REQUIRED_COLUMNS = ("ticker", "weight")


def parse_portfolio_csv(content: bytes | str) -> dict[str, float]:
    """Parse an uploaded CSV into a PortfolioIn-shaped weights dict.

    The result uses whatever positive scale the file contained (fractions,
    euros, share counts) — renormalization happens at the consuming
    entry points, like everywhere else in the project.
    """
    text = _decode(content)
    if not text.strip():
        raise ValueError("Die CSV-Datei ist leer.")

    delimiter, decimal = _detect_dialect(text)
    try:
        frame = pd.read_csv(io.StringIO(text), sep=delimiter, decimal=decimal)
    except pd.errors.EmptyDataError as exc:
        raise ValueError("Die CSV-Datei ist leer.") from exc
    except pd.errors.ParserError as exc:
        raise ValueError(f"Die CSV-Datei konnte nicht gelesen werden: {exc}") from exc

    # column detection by NAME after normalization (§10)
    frame.columns = [str(column).strip().lower() for column in frame.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    if missing:
        raise ValueError(
            f"Pflichtspalten fehlen in der CSV: {', '.join(missing)}. "
            f"Benötigt werden: {', '.join(REQUIRED_COLUMNS)}."
        )
    if frame.empty:
        raise ValueError("Die CSV-Datei enthält keine Datenzeilen.")

    tickers = frame["ticker"].astype(str).str.strip().str.upper()
    # astype(str) turns real NaN cells into "NAN" — both are empty tickers
    empty_rows = [
        str(index + 2)  # +2: header line + 1-based counting
        for index, ticker in enumerate(tickers)
        if not ticker or ticker == "NAN"
    ]
    if empty_rows:
        raise ValueError(f"Leere Ticker in der CSV (Zeile {', '.join(empty_rows)}).")

    try:
        weights = pd.to_numeric(frame["weight"], errors="raise")
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Ungültiger Gewichtswert in der CSV: {exc}") from exc
    if weights.isna().any():
        nan_rows = [str(i + 2) for i, is_nan in enumerate(weights.isna()) if is_nan]
        raise ValueError(
            f"Leere Gewichtswerte in der CSV (Zeile {', '.join(nan_rows)})."
        )

    negative = sorted(set(tickers[weights < 0]))
    if negative:
        raise ValueError(
            f"Negative Gewichte sind nicht erlaubt: {', '.join(negative)}."
        )

    # duplicates aggregate by sum — documented §10 behaviour
    aggregated = weights.groupby(tickers).sum()
    if aggregated.sum() <= 0:
        raise ValueError("Die Summe der Gewichte muss größer als 0 sein.")
    return {str(ticker): float(weight) for ticker, weight in aggregated.items()}


def _decode(content: bytes | str) -> str:
    if isinstance(content, str):
        return content
    try:
        return content.decode("utf-8-sig")  # tolerates the Excel BOM
    except UnicodeDecodeError:
        # German Excel often exports cp1252; ticker/weight payloads are
        # ASCII, so the single-byte fallback cannot corrupt them.
        return content.decode("cp1252")


def _detect_dialect(text: str) -> tuple[str, str]:
    """Delimiter + decimal separator from the header line.

    Semicolon files get the decimal comma ("0,5") — the German Excel
    pairing; comma files keep the decimal point.
    """
    first_line = next(line for line in text.splitlines() if line.strip())
    if first_line.count(";") > first_line.count(","):
        return ";", ","
    return ",", "."
