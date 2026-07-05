"""Static German explanation templates and lessons (ARCHITECTURE.md §5).

All texts are static templates with interpolated numbers — no LLM in the
core path (principle 2, graceful degradation). Wording is strictly
descriptive: NEVER an action recommendation for a specific security
(principle 3 — legally relevant for operation from Germany). Imperatives
are allowed only about concepts, never about securities. A regression
test (test_ampel.py) enforces this — keep it in mind for every edit here.

Lessons are general concept cards: static, identical for every status,
and free of any ticker names.
"""

from __future__ import annotations

from typing import Literal

import pandas as pd

AmpelStatus = Literal["green", "yellow", "red"]

LESSON_CONCENTRATION = (
    "Klumpenrisiko entsteht, wenn einzelne Werte einen großen Teil des "
    "Depots ausmachen. Der Herfindahl-Index (HHI) misst das: Er steigt, je "
    "ungleicher das Kapital verteilt ist – bei völliger Gleichverteilung "
    "liegt er bei 1 geteilt durch die Anzahl der Positionen. Streuung über "
    "mehrere Titel, Branchen und Regionen senkt die Abhängigkeit vom "
    "Kursverlauf einzelner Werte – Diversifikation gilt als eines der "
    "wenigen ‚kostenlosen' Mittel zur Risikosenkung."
)

LESSON_DIVERSIFICATION = (
    "Diversifikation heißt, Kapital auf Werte zu verteilen, die sich nicht "
    "im Gleichschritt bewegen. Die Diversification Ratio vergleicht die "
    "durchschnittliche Schwankung der Einzelwerte mit der Schwankung des "
    "Gesamtdepots: Werte deutlich über 1 zeigen, dass sich Schwankungen "
    "teilweise gegenseitig ausgleichen. Der Effekt wächst mit der Zahl der "
    "Positionen und sinkt, wenn sich die Werte sehr ähnlich verhalten – "
    "etwa bei Titeln aus derselben Branche."
)

LESSON_VOLATILITY = (
    "Volatilität misst, wie stark der Wert eines Depots um seinen "
    "Durchschnitt schwankt – hier annualisiert, also auf ein Jahr "
    "hochgerechnet. Sie ist das gängigste Risikomaß: Höhere Volatilität "
    "bedeutet größere mögliche Ausschläge nach oben wie nach unten. "
    "Volatilität ist keine Verlustprognose, aber ein Maß für die "
    "Unsicherheit, mit der bei einem Depot zu rechnen ist."
)


def _pct(share: float) -> str:
    """0.42 -> '42 %' (German spacing)."""
    return f"{share * 100:.0f} %"


def _num(value: float) -> str:
    """1.34 -> '1,34' (German decimal comma)."""
    return f"{value:.2f}".replace(".", ",")


def concentration_explanation(
    status: AmpelStatus, hhi: float, weights: pd.Series
) -> str:
    """Depot-specific text naming the concrete trigger (top position)."""
    top_ticker = str(weights.idxmax())
    top_share = float(weights.max())

    if status == "green":
        return (
            f"Dein Depot ist ausgewogen verteilt (HHI {_num(hhi)}): Die "
            f"größte Position ist {top_ticker} mit {_pct(top_share)}. Kein "
            f"einzelner Wert dominiert die Entwicklung."
        )
    if status == "yellow":
        return (
            f"Ein spürbarer Teil deines Depots hängt an wenigen Werten: "
            f"{top_ticker} macht {_pct(top_share)} aus (HHI {_num(hhi)})."
        )
    top3_clause = ""
    if len(weights) > 3:
        top3_share = float(weights.nlargest(3).sum())
        top3_clause = (
            f", die größten drei Positionen machen zusammen " f"{_pct(top3_share)} aus"
        )
    return (
        f"Dein Depot ist stark konzentriert: {_pct(top_share)} stecken "
        f"allein in {top_ticker}{top3_clause} (HHI {_num(hhi)}). Entwickelt "
        f"sich dieser Wert schlecht, schlägt das nahezu ungebremst auf dein "
        f"gesamtes Depot durch."
    )


def diversification_explanation(
    status: AmpelStatus, ratio: float, n_positions: int
) -> str:
    if status == "green":
        return (
            f"Dein Depot streut gut: {n_positions} Positionen, deren "
            f"Schwankungen sich teilweise gegenseitig ausgleichen "
            f"(Diversification Ratio {_num(ratio)})."
        )
    if status == "yellow":
        return (
            f"Dein Depot streut nur begrenzt: {n_positions} "
            f"{'Position' if n_positions == 1 else 'Positionen'} mit "
            f"Diversification Ratio {_num(ratio)}. Ein Teil der "
            f"Schwankungen gleicht sich aus, aber einzelne Werte prägen "
            f"die Entwicklung noch deutlich."
        )
    if n_positions == 1:
        return (
            "Dein Depot besteht aus einer einzigen Position – es gibt "
            "keine Streuung. Die Schwankungen dieses Werts sind eins zu "
            "eins die Schwankungen deines Depots."
        )
    return (
        f"Dein Depot streut kaum: Die {n_positions} Positionen bewegen "
        f"sich weitgehend im Gleichschritt (Diversification Ratio "
        f"{_num(ratio)}) – schwache Phasen treffen dann meist alle Werte "
        f"gleichzeitig."
    )


def volatility_explanation(status: AmpelStatus, annualized_vol: float) -> str:
    if status == "green":
        return (
            f"Dein Depot schwankt moderat: rund {_pct(annualized_vol)} pro "
            f"Jahr. Zwischenzeitliche Rücksetzer bleiben typischerweise "
            f"überschaubar."
        )
    if status == "yellow":
        return (
            f"Dein Depot schwankt spürbar: rund {_pct(annualized_vol)} pro "
            f"Jahr. In turbulenten Marktphasen sind zeitweise deutliche "
            f"Rückgänge des Depotwerts realistisch."
        )
    return (
        f"Dein Depot schwankt stark: rund {_pct(annualized_vol)} pro Jahr. "
        f"In schwachen Marktphasen kann der Depotwert zeitweise erheblich "
        f"einbrechen."
    )
