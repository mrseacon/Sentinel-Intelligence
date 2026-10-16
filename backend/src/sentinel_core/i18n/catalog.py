"""Text catalog: every backend-generated user-facing sentence, per language.

Rules (enforced by tests/test_i18n.py):
- Both languages have exactly the same keys.
- Per key, both templates use exactly the same `{placeholders}`.
- Per key, the German and English texts differ (no forgotten copies).
- Principle 3 (no recommendation for specific securities) holds for
  BOTH languages: descriptive wording, imperatives only about concepts.

Numbers are formatted by the callers via sentinel_core.i18n.format
BEFORE they are passed in, so templates only receive strings.
English copy: plain, natural English, no em or en dashes.
"""

from __future__ import annotations

from sentinel_core.i18n import Lang

_DE: dict[str, str] = {
    # --- Ampel titles + lessons (education/ampel.py) ------------------------
    "ampel.title.concentration": "Klumpenrisiko",
    "ampel.title.diversification": "Diversifikation",
    "ampel.title.volatility": "Volatilität",
    "ampel.lesson.concentration": (
        "Klumpenrisiko entsteht, wenn einzelne Werte einen großen Teil des "
        "Depots ausmachen. Der Herfindahl-Index (HHI) misst das: Er steigt, je "
        "ungleicher das Kapital verteilt ist. Bei völliger Gleichverteilung "
        "liegt er bei 1 geteilt durch die Anzahl der Positionen. Streuung über "
        "mehrere Titel, Branchen und Regionen senkt die Abhängigkeit vom "
        "Kursverlauf einzelner Werte: Diversifikation gilt als eines der "
        "wenigen ‚kostenlosen' Mittel zur Risikosenkung."
    ),
    "ampel.lesson.diversification": (
        "Diversifikation heißt, Kapital auf Werte zu verteilen, die sich nicht "
        "im Gleichschritt bewegen. Die Diversification Ratio vergleicht die "
        "durchschnittliche Schwankung der Einzelwerte mit der Schwankung des "
        "Gesamtdepots: Werte deutlich über 1 zeigen, dass sich Schwankungen "
        "teilweise gegenseitig ausgleichen. Der Effekt wächst mit der Zahl der "
        "Positionen und sinkt, wenn sich die Werte sehr ähnlich verhalten, "
        "etwa bei Titeln aus derselben Branche."
    ),
    "ampel.lesson.volatility": (
        "Volatilität misst, wie stark der Wert eines Depots um seinen "
        "Durchschnitt schwankt (hier annualisiert, also auf ein Jahr "
        "hochgerechnet). Sie ist das gängigste Risikomaß: Höhere Volatilität "
        "bedeutet größere mögliche Ausschläge nach oben wie nach unten. "
        "Volatilität ist keine Verlustprognose, aber ein Maß für die "
        "Unsicherheit, mit der bei einem Depot zu rechnen ist."
    ),
    # --- Ampel explanations (education/explanations.py) ---------------------
    "concentration.green": (
        "Dein Depot ist ausgewogen verteilt (HHI {hhi}): Die größte Position "
        "ist {ticker} mit {share}. Kein einzelner Wert dominiert die "
        "Entwicklung."
    ),
    "concentration.yellow": (
        "Ein spürbarer Teil deines Depots hängt an wenigen Werten: {ticker} "
        "macht {share} aus (HHI {hhi})."
    ),
    "concentration.red": (
        "Dein Depot ist stark konzentriert: {share} stecken allein in "
        "{ticker}{top3_clause} (HHI {hhi}). Entwickelt sich dieser Wert "
        "schlecht, schlägt das nahezu ungebremst auf dein gesamtes Depot durch."
    ),
    "concentration.top3_clause": (
        ", die größten drei Positionen machen zusammen {top3_share} aus"
    ),
    "diversification.green": (
        "Dein Depot streut gut: {n} Positionen, deren Schwankungen sich "
        "teilweise gegenseitig ausgleichen (Diversification Ratio {ratio})."
    ),
    "diversification.yellow": (
        "Dein Depot streut nur begrenzt: {n} {position_word} mit "
        "Diversification Ratio {ratio}. Ein Teil der Schwankungen gleicht sich "
        "aus, aber einzelne Werte prägen die Entwicklung noch deutlich."
    ),
    "diversification.position_singular": "Position",
    "diversification.position_plural": "Positionen",
    "diversification.red_single": (
        "Dein Depot besteht aus einer einzigen Position: Es gibt keine "
        "Streuung. Die Schwankungen dieses Werts sind eins zu eins die "
        "Schwankungen deines Depots."
    ),
    "diversification.red": (
        "Dein Depot streut kaum: Die {n} Positionen bewegen sich weitgehend im "
        "Gleichschritt (Diversification Ratio {ratio}). Schwache Phasen "
        "treffen dann meist alle Werte gleichzeitig."
    ),
    "volatility.green": (
        "Dein Depot schwankt moderat: rund {vol} pro Jahr. Zwischenzeitliche "
        "Rücksetzer bleiben typischerweise überschaubar."
    ),
    "volatility.yellow": (
        "Dein Depot schwankt spürbar: rund {vol} pro Jahr. In turbulenten "
        "Marktphasen sind zeitweise deutliche Rückgänge des Depotwerts "
        "realistisch."
    ),
    "volatility.red": (
        "Dein Depot schwankt stark: rund {vol} pro Jahr. In schwachen "
        "Marktphasen kann der Depotwert zeitweise erheblich einbrechen."
    ),
    # --- Stress test (STRESS_TEST_DECISIONS.md) -----------------------------
    "stress.title.gfc_2008": "Finanzkrise 2008/09",
    "stress.title.covid_2020": "Corona-Crash 2020",
    "stress.title.rates_2022": "Zinswende 2022",
    "stress.lesson.gfc_2008": (
        "Die Finanzkrise 2008/09 war eine systemische Krise: Fast alle "
        "Aktien fielen gemeinsam, Korrelationen stiegen sprunghaft an. "
        "Diversifikation innerhalb einer einzigen Anlageklasse bot nur "
        "begrenzten Schutz. Deshalb betrachtet man Streuung über "
        "Anlageklassen, Regionen und Branchen zusammen. Der breite Markt "
        "brauchte Jahre, um das Vorkrisenniveau wieder zu erreichen."
    ),
    "stress.lesson.covid_2020": (
        "Der Corona-Crash 2020 war der schnellste Einbruch der "
        "Börsengeschichte: rund ein Drittel Verlust in fünf Wochen. Ebenso "
        "ungewöhnlich war die anschließende Erholung. Wer im Tief ausstieg, "
        "verpasste die stärksten Erholungstage, denn den richtigen "
        "Zeitpunkt zu erraten gelingt selten. Volatilität bedeutet "
        "Ausschläge in beide Richtungen."
    ),
    "stress.lesson.rates_2022": (
        "Die Zinswende 2022 zeigte einen langsamen, monatelangen Bärenmarkt "
        "statt eines schnellen Crashs. Besonders stark fielen Wachstums- "
        "und Technologiewerte, deren Bewertungen empfindlich auf steigende "
        "Zinsen reagieren. Depots mit ausgeprägtem Branchen-Klumpen traf es "
        "überdurchschnittlich. Konzentration zeigt ihre Wirkung oft erst "
        "im Abschwung."
    ),
    "stress.disclaimer": (
        "Historische Szenarien beschreiben die Vergangenheit und sind keine "
        "Prognose. Annahme: Deine heutigen Gewichte bleiben im gesamten "
        "Zeitraum konstant."
    ),
    # "Im Szenario „X“" instead of "In der/dem X" — preset titles have
    # different grammatical genders (die Finanzkrise, der Corona-Crash).
    "stress.explanation": (
        "Im Szenario „{title}“ wäre dein Depot zeitweise um {drawdown} "
        "eingebrochen (maximaler Drawdown). Über den gesamten Zeitraum hätte "
        "es {total_return} {direction}."
    ),
    "stress.direction_lost": "verloren",
    "stress.direction_gained": "gewonnen",
    "stress.excluded_clause": (
        " Simuliert wurden {coverage} deines Depots. Nicht enthalten: "
        "{tickers} (im Zeitraum noch nicht handelbar)."
    ),
    # --- Monte Carlo (MONTE_CARLO_DECISIONS.md) -----------------------------
    "simulation.lesson": (
        "Eine Monte-Carlo-Simulation beantwortet nicht, wie es kommt, sondern "
        "wie unterschiedlich es kommen könnte: Sie mischt die tatsächlichen "
        "vergangenen Tagesbewegungen eines Depots zufällig neu und spielt "
        "daraus viele tausend mögliche Verläufe durch (Bootstrap-Verfahren). "
        "Die Bandbreite wächst mit dem Zeithorizont: Je weiter die Zukunft, "
        "desto weniger lässt sie sich eingrenzen. Der mittlere Verlauf ist "
        "kein Versprechen, sondern nur der Median der Simulationen. Und: Die "
        "Simulation kennt nur die Vergangenheit. Ereignisse, die es dort "
        "nicht gab, kann sie nicht zeigen."
    ),
    "simulation.disclaimer": (
        "Simulation auf Basis vergangener Tagesrenditen, keine Vorhersage. "
        "Die tatsächliche Entwicklung kann außerhalb jeder gezeigten "
        "Bandbreite liegen. Annahme: Deine heutigen Gewichte bleiben im "
        "gesamten Zeitraum konstant."
    ),
    "simulation.explanation": (
        "In 8 von 10 simulierten Verläufen lag der Depotwert nach {horizon} "
        "{year_word} zwischen dem {p10}-Fachen und dem {p90}-Fachen des "
        "heutigen Werts; der mittlere simulierte Verlauf endete beim "
        "{p50}-Fachen. Datenbasis: {history_years} Jahre tägliche "
        "Kurshistorie{limit_clause}."
    ),
    "simulation.year_singular": "Jahr",
    "simulation.year_plural": "Jahren",
    "simulation.limit_clause": ", begrenzt durch {ticker}",
    "simulation.thin_history": (
        " Achtung, dünne Datenbasis: Für diesen Horizont wird die verfügbare "
        "Historie rechnerisch rund {recycling}-mal wiederverwendet. Seltene "
        "Ereignisse wie Crashs fehlen darin womöglich vollständig."
    ),
    # --- Benchmark comparison (risk/benchmark-compare) ----------------------
    "benchmark.vol_similar": "schwankt ähnlich stark wie der {title}",
    "benchmark.vol_higher": "schwankt stärker als der {title}",
    "benchmark.vol_lower": "schwankt ruhiger als der {title}",
    "benchmark.score_similar": (
        "Der Risiko-Score liegt in einer ähnlichen Größenordnung."
    ),
    "benchmark.score_higher": (
        "Der Risiko-Score liegt {points} Punkte höher als beim {title}."
    ),
    "benchmark.score_lower": (
        "Der Risiko-Score liegt {points} Punkte niedriger als beim {title}."
    ),
    "benchmark.comparison": (
        "Dein Depot {vol_clause}: {portfolio_vol} gegenüber {benchmark_vol} "
        "pro Jahr. {score_clause}"
    ),
    # --- Optimizer (API_CONTRACT §2.6, principle 3) -------------------------
    "optimize.disclaimer": (
        "Rechnerische Max-Sharpe-Gewichtung der eingegebenen Titel auf Basis "
        "vergangener Kurse. Keine Empfehlung, Vergangenheit ist keine "
        "Garantie für die Zukunft."
    ),
    # --- PDF report (sentinel_api/reports/pdf.py) ---------------------------
    # Identical wording to the frontend disclaimer (lib/i18n/dictionaries).
    "pdf.disclaimer": (
        "Sentinel beschreibt Portfolioeigenschaften (z. B. Klumpenrisiko, "
        "Volatilität) auf Basis vergangener Kurse. Das ist keine "
        "Anlageberatung und keine Empfehlung für einzelne Wertpapiere. "
        "Kurse sind bis zu 15 Minuten verzögert."
    ),
    "pdf.document_title": "Sentinel Risiko-Report",
    "pdf.heading": "Sentinel: Risiko-Report",
    "pdf.generated_at": "Erstellt am {date}, {time} UTC",
    "pdf.section_weights": "Portfolio-Zusammensetzung",
    "pdf.section_score": "Risiko-Score",
    "pdf.section_ampel": "Risiko-Ampel",
    "pdf.section_stress": "Historischer Stress-Test",
    "pdf.col_weight": "Gewicht",
    "pdf.row_rating": "Einstufung",
    "pdf.what_does_this_mean": "Was heißt das?",
    "pdf.scenario": "Szenario: {title}",
    "pdf.stress_period": (
        "Zeitraum {start} bis {end}. Maximaler Rückgang {drawdown}, "
        "Gesamtrendite {total_return}, Abdeckung {coverage} des Depots."
    ),
    "pdf.page": "Seite {page}",
    "pdf.filename": "sentinel-risiko-report-{date}.pdf",
    "status.green": "Grün",
    "status.yellow": "Gelb",
    "status.red": "Rot",
    "score_label.Low": "Niedrig",
    "score_label.Moderate": "Moderat",
    "score_label.High": "Hoch",
    "score_label.Severe": "Sehr hoch",
    "factor.volatility": "Volatilität",
    "factor.max_drawdown": "Maximaler Rückgang",
    "factor.var_95": "Value at Risk (95 %)",
    "factor.cvar_95": "Conditional VaR (95 %)",
    "factor.concentration": "Konzentration",
}

_EN: dict[str, str] = {
    "ampel.title.concentration": "Concentration risk",
    "ampel.title.diversification": "Diversification",
    "ampel.title.volatility": "Volatility",
    "ampel.lesson.concentration": (
        "Concentration risk arises when a few holdings make up a large part "
        "of a portfolio. The Herfindahl index (HHI) measures this: it rises "
        "the more unevenly the capital is spread. With a perfectly even "
        "split, it equals 1 divided by the number of positions. Spreading "
        "across several securities, sectors and regions reduces the "
        "dependence on how any single holding performs: diversification is "
        "considered one of the few 'free' ways to lower risk."
    ),
    "ampel.lesson.diversification": (
        "Diversification means spreading capital across holdings that do not "
        "move in lockstep. The diversification ratio compares the average "
        "volatility of the individual holdings with the volatility of the "
        "whole portfolio: values well above 1 show that fluctuations partly "
        "offset each other. The effect grows with the number of positions "
        "and shrinks when the holdings behave very similarly, for example "
        "securities from the same sector."
    ),
    "ampel.lesson.volatility": (
        "Volatility measures how strongly the value of a portfolio swings "
        "around its average (annualized here, meaning scaled to one year). "
        "It is the most widely used risk measure: higher volatility means "
        "larger possible swings, both up and down. Volatility is not a loss "
        "forecast, but it shows how much uncertainty comes with a portfolio."
    ),
    "concentration.green": (
        "Your portfolio is evenly spread (HHI {hhi}): the largest position "
        "is {ticker} at {share}. No single holding dominates its performance."
    ),
    "concentration.yellow": (
        "A noticeable part of your portfolio depends on a few holdings: "
        "{ticker} accounts for {share} (HHI {hhi})."
    ),
    "concentration.red": (
        "Your portfolio is highly concentrated: {share} is in {ticker} "
        "alone{top3_clause} (HHI {hhi}). If this holding performs poorly, "
        "the effect passes almost unchecked to your entire portfolio."
    ),
    "concentration.top3_clause": (
        ", and the three largest positions together account for {top3_share}"
    ),
    "diversification.green": (
        "Your portfolio is well diversified: {n} positions whose swings "
        "partly offset each other (diversification ratio {ratio})."
    ),
    "diversification.yellow": (
        "Your portfolio is only partly diversified: {n} {position_word} with "
        "a diversification ratio of {ratio}. Some of the swings offset each "
        "other, but individual holdings still clearly shape its performance."
    ),
    "diversification.position_singular": "position",
    "diversification.position_plural": "positions",
    "diversification.red_single": (
        "Your portfolio consists of a single position, so there is no "
        "diversification. The swings of this holding are exactly the swings "
        "of your portfolio."
    ),
    "diversification.red": (
        "Your portfolio is barely diversified: its {n} positions largely "
        "move in lockstep (diversification ratio {ratio}). Weak phases then "
        "usually hit all holdings at the same time."
    ),
    "volatility.green": (
        "Your portfolio fluctuates moderately: around {vol} per year. "
        "Temporary setbacks typically stay manageable."
    ),
    "volatility.yellow": (
        "Your portfolio fluctuates noticeably: around {vol} per year. In "
        "turbulent market phases, significant temporary drops in its value "
        "are realistic."
    ),
    "volatility.red": (
        "Your portfolio fluctuates strongly: around {vol} per year. In weak "
        "market phases, its value can drop considerably for a while."
    ),
    "stress.title.gfc_2008": "Financial crisis 2008/09",
    "stress.title.covid_2020": "Covid crash 2020",
    "stress.title.rates_2022": "Rate-hike bear market 2022",
    "stress.lesson.gfc_2008": (
        "The 2008/09 financial crisis was a systemic crisis: almost all "
        "stocks fell together and correlations jumped. Diversification "
        "within a single asset class offered only limited protection. That "
        "is why diversification is considered across asset classes, regions "
        "and sectors together. The broad market took years to return to its "
        "pre-crisis level."
    ),
    "stress.lesson.covid_2020": (
        "The 2020 Covid crash was the fastest decline in stock market "
        "history: a loss of about one third in five weeks. The recovery that "
        "followed was just as unusual. Anyone who got out at the bottom "
        "missed the strongest recovery days, because guessing the right "
        "moment rarely works. Volatility means swings in both directions."
    ),
    "stress.lesson.rates_2022": (
        "In 2022, rising interest rates led to a slow bear market that "
        "lasted for months rather than a quick crash. Growth and technology "
        "stocks, whose valuations react sensitively to rising rates, fell "
        "especially hard. Portfolios with a strong sector concentration were "
        "hit harder than average. Concentration often only shows its effect "
        "in a downturn."
    ),
    "stress.disclaimer": (
        "Historical scenarios describe the past and are not a forecast. "
        "Assumption: your current weights stay constant over the entire "
        "period."
    ),
    "stress.explanation": (
        'In the scenario "{title}", your portfolio would at times have '
        "dropped by {drawdown} (maximum drawdown). Over the entire period it "
        "would have {direction} {total_return}."
    ),
    "stress.direction_lost": "lost",
    "stress.direction_gained": "gained",
    "stress.excluded_clause": (
        " {coverage} of your portfolio was simulated. Not included: "
        "{tickers} (not yet tradable during this period)."
    ),
    "simulation.lesson": (
        "A Monte Carlo simulation does not answer how things will turn out, "
        "but how differently they could turn out: it randomly reshuffles a "
        "portfolio's actual past daily moves and plays through many "
        "thousands of possible paths (bootstrap method). The range widens "
        "with the time horizon: the further into the future, the harder it "
        "is to narrow down. The middle path is not a promise, just the "
        "median of the simulations. And the simulation only knows the past. "
        "It cannot show events that never happened there."
    ),
    "simulation.disclaimer": (
        "Simulation based on past daily returns, not a prediction. The "
        "actual outcome may fall outside any range shown. Assumption: your "
        "current weights stay constant over the entire period."
    ),
    "simulation.explanation": (
        "In 8 out of 10 simulated paths, the portfolio value after {horizon} "
        "{year_word} was between {p10}x and {p90}x today's value; the middle "
        "simulated path ended at {p50}x. Data basis: {history_years} years "
        "of daily price history{limit_clause}."
    ),
    "simulation.year_singular": "year",
    "simulation.year_plural": "years",
    "simulation.limit_clause": ", limited by {ticker}",
    "simulation.thin_history": (
        " Note the thin data basis: for this horizon, the available history "
        "is effectively reused about {recycling} times. Rare events such as "
        "crashes may be missing from it entirely."
    ),
    "benchmark.vol_similar": "fluctuates about as much as the {title}",
    "benchmark.vol_higher": "fluctuates more than the {title}",
    "benchmark.vol_lower": "fluctuates less than the {title}",
    "benchmark.score_similar": "The risk score is in a similar range.",
    "benchmark.score_higher": (
        "The risk score is {points} points higher than for the {title}."
    ),
    "benchmark.score_lower": (
        "The risk score is {points} points lower than for the {title}."
    ),
    "benchmark.comparison": (
        "Your portfolio {vol_clause}: {portfolio_vol} versus {benchmark_vol} "
        "per year. {score_clause}"
    ),
    "optimize.disclaimer": (
        "Mathematical max-Sharpe weighting of the entered securities based "
        "on past prices. Not a recommendation; past performance is no "
        "guarantee of future results."
    ),
    "pdf.disclaimer": (
        "Sentinel describes portfolio properties (e.g. concentration risk, "
        "volatility) based on past prices. This is not investment advice and "
        "not a recommendation for any individual security. Prices are "
        "delayed by up to 15 minutes."
    ),
    "pdf.document_title": "Sentinel Risk Report",
    "pdf.heading": "Sentinel: Risk Report",
    "pdf.generated_at": "Generated on {date}, {time} UTC",
    "pdf.section_weights": "Portfolio composition",
    "pdf.section_score": "Risk score",
    "pdf.section_ampel": "Risk traffic light",
    "pdf.section_stress": "Historical stress test",
    "pdf.col_weight": "Weight",
    "pdf.row_rating": "Rating",
    "pdf.what_does_this_mean": "What does this mean?",
    "pdf.scenario": "Scenario: {title}",
    "pdf.stress_period": (
        "Period {start} to {end}. Maximum drop {drawdown}, total return "
        "{total_return}, coverage {coverage} of the portfolio."
    ),
    "pdf.page": "Page {page}",
    "pdf.filename": "sentinel-risk-report-{date}.pdf",
    "status.green": "Green",
    "status.yellow": "Yellow",
    "status.red": "Red",
    "score_label.Low": "Low",
    "score_label.Moderate": "Moderate",
    "score_label.High": "High",
    "score_label.Severe": "Severe",
    "factor.volatility": "Volatility",
    "factor.max_drawdown": "Maximum drawdown",
    "factor.var_95": "Value at Risk (95%)",
    "factor.cvar_95": "Conditional VaR (95%)",
    "factor.concentration": "Concentration",
}

TEXTS: dict[Lang, dict[str, str]] = {"de": _DE, "en": _EN}


def t(lang: Lang, key: str, **values: str) -> str:
    """Look up a template and fill its placeholders.

    A missing key or placeholder raises (KeyError) instead of silently
    rendering a half-filled sentence — tests cover every key per language.
    """
    return TEXTS[lang][key].format(**values)
