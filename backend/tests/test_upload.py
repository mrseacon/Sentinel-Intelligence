"""CSV upload tests per KNOWLEDGE_EXTRACTION.md §10: header
normalization, hard errors for empty tickers / negative weights /
non-positive sum, duplicate aggregation by sum, no silent NaN
swallowing — plus the own decisions (BOM/cp1252, semicolon dialect).
"""

import pytest

from sentinel_core.portfolio.upload import parse_portfolio_csv


def test_valid_comma_csv():
    result = parse_portfolio_csv("ticker,weight\nAAPL,0.6\nMSFT,0.4\n")

    assert result == {"AAPL": 0.6, "MSFT": 0.4}


def test_header_names_are_normalized_and_order_is_irrelevant():
    # " Ticker " / "WEIGHT" must work (§10); extra columns are ignored,
    # column ORDER does not matter — detection is by name.
    csv = "WEIGHT, Ticker ,kommentar\n0.5,aapl,Langfrist\n0.5, msft ,Test\n"

    result = parse_portfolio_csv(csv)

    assert result == {"AAPL": 0.5, "MSFT": 0.5}  # tickers stripped+uppered


def test_semicolon_csv_with_german_decimal_comma():
    # German Excel default: semicolon delimiter + decimal comma.
    csv = "ticker;weight\nAAPL;0,6\nSAP.DE;0,4\n"

    result = parse_portfolio_csv(csv)

    assert result == {"AAPL": 0.6, "SAP.DE": 0.4}


def test_euro_amounts_are_kept_unnormalized():
    # Weights need NOT sum to 1 (§10) — normalization is downstream.
    result = parse_portfolio_csv("ticker,weight\nAAPL,5000\nMSFT,3000\n")

    assert result == {"AAPL": 5000.0, "MSFT": 3000.0}


def test_duplicate_tickers_are_aggregated_by_sum():
    # Documented, tested legacy behaviour (§10): groupby.sum, no error.
    csv = "ticker,weight\nAAPL,300\nMSFT,200\naapl,200\n"

    result = parse_portfolio_csv(csv)

    assert result == {"AAPL": 500.0, "MSFT": 200.0}


def test_utf8_bom_from_excel_is_tolerated():
    content = "﻿ticker,weight\nAAPL,1\n".encode()

    assert parse_portfolio_csv(content) == {"AAPL": 1.0}


def test_cp1252_fallback_for_german_excel_exports():
    # Umlaut in an ignored extra column, encoded as cp1252 (not UTF-8).
    content = "ticker,weight,name\nAAPL,1,Müller\n".encode("cp1252")

    assert parse_portfolio_csv(content) == {"AAPL": 1.0}


def test_missing_required_column_is_named():
    with pytest.raises(ValueError, match="Pflichtspalten fehlen.*weight"):
        parse_portfolio_csv("ticker,menge\nAAPL,5\n")


def test_empty_file_and_header_only_are_rejected():
    with pytest.raises(ValueError, match="CSV-Datei ist leer"):
        parse_portfolio_csv("   \n  ")
    with pytest.raises(ValueError, match="keine Datenzeilen"):
        parse_portfolio_csv("ticker,weight\n")


def test_empty_ticker_cell_is_a_hard_error_with_row_number():
    with pytest.raises(ValueError, match=r"Leere Ticker in der CSV \(Zeile 3\)"):
        parse_portfolio_csv("ticker,weight\nAAPL,0.5\n ,0.5\n")


def test_unparseable_weight_is_rejected_not_swallowed():
    with pytest.raises(ValueError, match="Ungültiger Gewichtswert"):
        parse_portfolio_csv("ticker,weight\nAAPL,viel\n")


def test_empty_weight_cell_is_rejected_not_swallowed():
    # to_numeric passes real NaN through — the explicit check catches it.
    with pytest.raises(ValueError, match=r"Leere Gewichtswerte.*Zeile 2"):
        parse_portfolio_csv("ticker,weight\nAAPL,\nMSFT,1\n")


def test_negative_weight_is_rejected_by_ticker_name():
    with pytest.raises(ValueError, match="Negative Gewichte.*MSFT"):
        parse_portfolio_csv("ticker,weight\nAAPL,1\nMSFT,-0.2\n")


def test_zero_weight_sum_is_rejected():
    with pytest.raises(ValueError, match="Summe der Gewichte"):
        parse_portfolio_csv("ticker,weight\nAAPL,0\nMSFT,0\n")


def test_result_feeds_directly_into_normalize_weights():
    # The contract with PortfolioIn: whatever scale the CSV used, the
    # existing entry points renormalize it.
    from sentinel_core.risk.metrics import normalize_weights

    weights = parse_portfolio_csv("ticker;weight\nAAPL;5000\nMSFT;5000\n")

    normalized = normalize_weights(weights)
    assert normalized["AAPL"] == pytest.approx(0.5)
