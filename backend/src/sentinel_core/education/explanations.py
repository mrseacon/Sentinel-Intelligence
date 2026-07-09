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


# --- stress test replay (STRESS_TEST_DECISIONS.md) ---------------------------
# One static concept card per crisis preset, keyed by preset id. Like the
# Ampel lessons: ticker-free, purely descriptive, past tense for history.

STRESS_LESSONS = {
    "gfc_2008": (
        "Die Finanzkrise 2008/09 war eine systemische Krise: Fast alle "
        "Aktien fielen gemeinsam, Korrelationen stiegen sprunghaft an. "
        "Diversifikation innerhalb einer einzigen Anlageklasse bot nur "
        "begrenzten Schutz – deshalb betrachtet man Streuung über "
        "Anlageklassen, Regionen und Branchen zusammen. Der breite Markt "
        "brauchte Jahre, um das Vorkrisenniveau wieder zu erreichen."
    ),
    "covid_2020": (
        "Der Corona-Crash 2020 war der schnellste Einbruch der "
        "Börsengeschichte: rund ein Drittel Verlust in fünf Wochen. Ebenso "
        "ungewöhnlich war die anschließende Erholung. Wer im Tief ausstieg, "
        "verpasste die stärksten Erholungstage – den richtigen Zeitpunkt zu "
        "erraten gelingt selten. Volatilität bedeutet Ausschläge in beide "
        "Richtungen."
    ),
    "rates_2022": (
        "Die Zinswende 2022 zeigte einen langsamen, monatelangen Bärenmarkt "
        "statt eines schnellen Crashs. Besonders stark fielen Wachstums- "
        "und Technologiewerte, deren Bewertungen empfindlich auf steigende "
        "Zinsen reagieren. Depots mit ausgeprägtem Branchen-Klumpen traf es "
        "überdurchschnittlich – Konzentration zeigt ihre Wirkung oft erst "
        "im Abschwung."
    ),
}

STRESS_DISCLAIMER = (
    "Historische Szenarien beschreiben die Vergangenheit und sind keine "
    "Prognose. Annahme: Deine heutigen Gewichte bleiben im gesamten "
    "Zeitraum konstant."
)


def stress_explanation(
    title: str,
    max_dd: float,
    total_return: float,
    coverage: float,
    excluded: list[str],
) -> str:
    """Depot-specific replay text: past tense, descriptive, with numbers."""
    direction = "verloren" if total_return < 0 else "gewonnen"
    # "Im Szenario „X““ instead of "In der/dem X" — preset titles have
    # different grammatical genders (die Finanzkrise, der Corona-Crash).
    text = (
        f"Im Szenario „{title}“ wäre dein Depot zeitweise um "
        f"{_pct(abs(max_dd))} eingebrochen (maximaler Drawdown). Über den "
        f"gesamten Zeitraum hätte es {_pct(abs(total_return))} {direction}."
    )
    if excluded:
        text += (
            f" Simuliert wurden {_pct(coverage)} deines Depots – nicht "
            f"enthalten: {', '.join(excluded)} (im Zeitraum noch nicht "
            f"handelbar)."
        )
    return text


# --- Monte Carlo simulation (MONTE_CARLO_DECISIONS.md) -----------------------
# Frequency wording instead of probability language, subjunctive, median
# never labeled "expected" — the fan must not read as a forecast.

SIM_LESSON = (
    "Eine Monte-Carlo-Simulation beantwortet nicht, wie es kommt, sondern "
    "wie unterschiedlich es kommen könnte: Sie mischt die tatsächlichen "
    "vergangenen Tagesbewegungen eines Depots zufällig neu und spielt "
    "daraus viele tausend mögliche Verläufe durch (Bootstrap-Verfahren). "
    "Die Bandbreite wächst mit dem Zeithorizont – je weiter die Zukunft, "
    "desto weniger lässt sie sich eingrenzen. Der mittlere Verlauf ist "
    "kein Versprechen, sondern nur der Median der Simulationen. Und: Die "
    "Simulation kennt nur die Vergangenheit – Ereignisse, die es dort "
    "nicht gab, kann sie nicht zeigen."
)

SIM_DISCLAIMER = (
    "Simulation auf Basis vergangener Tagesrenditen – keine Vorhersage. "
    "Die tatsächliche Entwicklung kann außerhalb jeder gezeigten "
    "Bandbreite liegen. Annahme: Deine heutigen Gewichte bleiben im "
    "gesamten Zeitraum konstant."
)


def simulation_explanation(
    horizon_years: int,
    final_p10: float,
    final_p50: float,
    final_p90: float,
    history_years: float,
    limiting_ticker: str | None,
    recycling_factor: float,
    thin_history: bool,
) -> str:
    """Frequency-worded fan summary with mandatory data-basis transparency."""
    year_word = "Jahr" if horizon_years == 1 else "Jahren"
    limit_clause = f", begrenzt durch {limiting_ticker}" if limiting_ticker else ""
    text = (
        f"In 8 von 10 simulierten Verläufen lag der Depotwert nach "
        f"{horizon_years} {year_word} zwischen dem {_num(final_p10)}-Fachen "
        f"und dem {_num(final_p90)}-Fachen des heutigen Werts; der mittlere "
        f"simulierte Verlauf endete beim {_num(final_p50)}-Fachen. "
        f"Datenbasis: {_num1(history_years)} Jahre tägliche "
        f"Kurshistorie{limit_clause}."
    )
    if thin_history:
        text += (
            f" Achtung, dünne Datenbasis: Für diesen Horizont wird die "
            f"verfügbare Historie rechnerisch rund "
            f"{_num1(recycling_factor)}-mal wiederverwendet – seltene "
            f"Ereignisse wie Crashs fehlen darin womöglich vollständig."
        )
    return text


def _num1(value: float) -> str:
    """7.14 -> '7,1' (German decimal comma, one decimal)."""
    return f"{value:.1f}".replace(".", ",")


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
