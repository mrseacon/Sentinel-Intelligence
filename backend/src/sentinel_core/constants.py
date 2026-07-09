"""Single source of truth for all domain constants (ARCHITECTURE.md §4.2).

Every value here is a deliberate, documented domain decision. Do not change
anchors, weights or thresholds silently — update ARCHITECTURE.md §10 if a
value is still uncalibrated. Sources: ARCHITECTURE.md §4/§5,
KNOWLEDGE_EXTRACTION.md §2/§5/§7.
"""

# --- Return conventions (KNOWLEDGE_EXTRACTION §2) ---------------------------

# Annualization basis for volatility (* sqrt) and returns (* factor).
# Was duplicated three times in the old project — lives ONLY here now.
TRADING_DAYS = 252

# Confidence level for historical VaR/CVaR. Fixed convention from the
# legacy project (§4/§5): the score anchors are calibrated for 95 %.
VAR_CONFIDENCE = 0.95

# --- Risk score: normalization anchors (KNOWLEDGE_EXTRACTION §5) ------------
# Each factor is normalized against its anchor ("= 1.0") and clamped to 0..1.
# Deliberately explainable heuristics, not fitted parameters.

SCORE_ANCHOR_VOLATILITY = 0.40  # 40 % p.a. counts as "high" volatility
SCORE_ANCHOR_MAX_DRAWDOWN = 0.50  # 50 % drawdown counts as "extreme"
SCORE_ANCHOR_VAR_95 = 0.05  # 5 % daily VaR counts as "high"
SCORE_ANCHOR_CVAR_95 = 0.08  # 8 % daily CVaR counts as "high"
# HHI normalization: (HHI - floor) / range. 0.10 = well diversified,
# ~0.30 and above = fully concentrated.
SCORE_HHI_FLOOR = 0.10
SCORE_HHI_RANGE = 0.20

# --- Risk score: factor weights (KNOWLEDGE_EXTRACTION §5) -------------------
# Volatility and drawdown dominate by design. Must sum to 1.0.

SCORE_WEIGHT_VOLATILITY = 0.30
SCORE_WEIGHT_MAX_DRAWDOWN = 0.30
SCORE_WEIGHT_VAR = 0.20
SCORE_WEIGHT_CVAR = 0.15
SCORE_WEIGHT_CONCENTRATION = 0.05

# --- Risk score: label boundaries (KNOWLEDGE_EXTRACTION §5) -----------------
# score <= 25 Low, <= 50 Moderate, <= 75 High, else Severe.

SCORE_LABEL_LOW_MAX = 25
SCORE_LABEL_MODERATE_MAX = 50
SCORE_LABEL_HIGH_MAX = 75

# --- AI risk adjustment (KNOWLEDGE_EXTRACTION §7) ---------------------------
# Deterministic sentiment -> score delta mapping. Asymmetry is intentional:
# negative sentiment raises the score more (+4/+8) than positive sentiment
# lowers it (-3/-6) — conservative risk principle. The delta is scaled by
# LLM confidence downstream.

SENTIMENT_SCORE_DELTA = {2: -6, 1: -3, 0: 0, -1: 4, -2: 8}

# --- News pipeline (KNOWLEDGE_EXTRACTION §9) --------------------------------

# Macro queries run first, in this order — a domain decision from the
# legacy project (market-wide risk before company news).
NEWS_MACRO_QUERIES = (
    "US stock market risk",
    "Federal Reserve interest rates",
    "inflation outlook",
)
# Per-ticker feed limit; keeps company news from crowding out macro.
NEWS_LIMIT_PER_TICKER = 4
# Hard cap keeps the LLM prompt size bounded (§9).
NEWS_MAX_HEADLINES = 25
# Polite throttle between RSS requests to avoid Google rate limiting.
NEWS_THROTTLE_SECONDS = 0.4

# --- Portfolio optimization (KNOWLEDGE_EXTRACTION §11) ----------------------

# Per-asset cap; without it max-Sharpe tends to put everything into a
# single asset. Long-only lower bound is 0 by convention.
OPTIMIZER_MAX_WEIGHT = 0.6

# --- Paper trading (ARCHITECTURE §4.1) --------------------------------------

# Starting play money per paper account.
PAPER_START_CASH = 10_000.0
# Flat fee per trade: teaches that trading costs money without being complex.
PAPER_TRADE_FEE = 1.0

# --- Stress test replay (STRESS_TEST_DECISIONS.md) --------------------------

# Minimum share of portfolio weight that must be simulatable in a crisis
# window; below this the replay is rejected as not meaningful.
# Uncalibrated v1 value (ARCHITECTURE §10).
STRESS_MIN_COVERAGE = 0.5

# An asset participates only if its history starts within this many
# trading days after the window start. Later IPOs are excluded BEFORE
# return computation so they cannot silently truncate the window
# (daily_returns drops rows outside the common history).
STRESS_START_TOLERANCE_DAYS = 5

# Peak-to-trough crisis windows: each starts at the pre-crash market high
# and ends at the bear-market low. Verified against S&P 500 (^GSPC)
# closing prices on 2026-07-06. Boundaries are domain decisions —
# never change silently (ARCHITECTURE §10).
STRESS_PRESETS = {
    "gfc_2008": {
        "title": "Finanzkrise 2008/09",
        "start": "2007-10-09",  # S&P 500 pre-crisis high (1565.15)
        "end": "2009-03-09",  # bear-market low (676.53)
    },
    "covid_2020": {
        "title": "Corona-Crash 2020",
        "start": "2020-02-19",  # high 3386.15
        "end": "2020-03-23",  # low 2237.40
    },
    "rates_2022": {
        "title": "Zinswende 2022",
        "start": "2022-01-03",  # high 4796.56
        "end": "2022-10-12",  # low 3577.03
    },
}

# --- Monte Carlo simulation (MONTE_CARLO_DECISIONS.md) ----------------------

# Fixed selectable horizons; free input would invite pseudo financial
# planning (decision doc §6).
SIM_HORIZONS_YEARS = (1, 5, 10)
# Path count: stabilizes the 10th/50th/90th percentile well below one
# second of compute. Set but uncalibrated (ARCHITECTURE §10).
SIM_N_PATHS = 2000
# Fixed seed: same input -> same fan. Without it the fan changes on
# every reload and reads like a random oracle instead of an analysis.
SIM_SEED = 42
# Below this common history the simulation is rejected (~1 trading year
# incl. at least one full earnings season). Uncalibrated (§10).
SIM_MIN_HISTORY_DAYS = 250
# Below this many years of history the thin-history warning is shown.
SIM_THIN_HISTORY_YEARS = 3.0
# Fan support points roughly monthly (in trading days).
SIM_SUPPORT_STEP_DAYS = 21

# --- Risk-Ampel thresholds (ARCHITECTURE §5, v1 — uncalibrated) -------------
# Calibration with real example portfolios is an open decision
# (ARCHITECTURE §10). Green/yellow bounds; anything beyond yellow is red.

# Concentration (HHI): <= 0.15 green, <= 0.30 yellow, else red.
AMPEL_HHI_GREEN_MAX = 0.15
AMPEL_HHI_YELLOW_MAX = 0.30

# Diversification: DR >= 1.3 and >= 5 positions green, DR >= 1.1 yellow.
AMPEL_DR_GREEN_MIN = 1.3
AMPEL_DR_YELLOW_MIN = 1.1
AMPEL_MIN_POSITIONS_GREEN = 5

# Annualized portfolio volatility: <= 15 % green, <= 25 % yellow, else red.
AMPEL_VOL_GREEN_MAX = 0.15
AMPEL_VOL_YELLOW_MAX = 0.25
