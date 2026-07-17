"""Deterministic, asymmetric AI risk adjustment (KNOWLEDGE_EXTRACTION.md §7).

Transparent rules, NOT a black box: sentiment maps to a fixed score
delta from constants.py — negative news raise the score more (+4/+8)
than positive news lower it (-3/-6), a conservative risk principle. The
delta is scaled by the LLM's confidence and rounded to int: low
confidence means little influence.

assess_market is the public, NEVER-raising entry point: every failure
in the LLM cascade (§8) degrades to a neutral assessment with a German
reason text (principle 2). LLM bullets pass the principle-3 guardrail
before they reach the result.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from sentinel_core.ai.guardrails import filter_llm_bullets
from sentinel_core.ai.llm_client import generate, parse_market_context
from sentinel_core.constants import SENTIMENT_SCORE_DELTA
from sentinel_core.errors import SentinelError


class AiAssessment(BaseModel):
    """Always-usable result: neutral (delta 0) when the LLM is unavailable."""

    model_config = ConfigDict(frozen=True)

    available: bool
    sentiment: int
    confidence: float
    score_delta: int
    bullets: list[str]
    rationale: str  # always present (§7: the rationale is part of the contract)


def sentiment_delta(sentiment: int, confidence: float) -> int:
    """Score delta for one sentiment step, scaled by confidence (§7)."""
    if sentiment not in SENTIMENT_SCORE_DELTA:
        raise SentinelError(
            f"Sentiment muss eine ganze Zahl in [-2, 2] sein ({sentiment})."
        )
    if not 0 <= confidence <= 1:
        raise SentinelError(f"Confidence muss zwischen 0 und 1 liegen ({confidence}).")
    return int(round(SENTIMENT_SCORE_DELTA[sentiment] * confidence))


def adjusted_score(score: float, delta: int) -> float:
    """Apply a delta to a risk score, clamped to the 0..100 range."""
    return min(max(score + delta, 0.0), 100.0)


def assess_market(headlines: list[str]) -> AiAssessment:
    """LLM market assessment with full graceful degradation.

    Any failure — missing key/package (RuntimeError), timeout or API
    error, unparseable answer (ValueError) — yields a neutral result
    instead of an exception (principle 2).
    """
    try:
        raw = generate(_build_prompt(headlines))
        context = parse_market_context(raw)
    except Exception as exc:  # noqa: BLE001 — deliberate cascade catch (§8)
        return _neutral(str(exc))

    delta = sentiment_delta(context.sentiment, context.confidence)
    return AiAssessment(
        available=True,
        sentiment=context.sentiment,
        confidence=context.confidence,
        score_delta=delta,
        bullets=filter_llm_bullets(context.bullets),
        rationale=(
            f"KI-Einschätzung: Sentiment {context.sentiment:+d} bei "
            f"Confidence {context.confidence * 100:.0f} % → "
            f"Score-Anpassung {delta:+d} Punkte."
        ),
    )


def _build_prompt(headlines: list[str]) -> str:
    joined = "\n".join(f"- {headline}" for headline in headlines)
    return (
        "Bewerte das aktuelle Marktrisiko anhand der folgenden "
        "Schlagzeilen. Antworte AUSSCHLIESSLICH mit striktem JSON im "
        'Format {"sentiment": <int -2..2>, "confidence": <float 0..1>, '
        '"bullets": [<3 bis 5 deutsche Stichpunkte>]}. Die Stichpunkte '
        "beschreiben Marktlage und Risiken, niemals Empfehlungen zu "
        "einzelnen Wertpapieren.\n\n"
        f"Schlagzeilen:\n{joined}"
    )


def _neutral(reason: str) -> AiAssessment:
    return AiAssessment(
        available=False,
        sentiment=0,
        confidence=0.0,
        score_delta=0,
        bullets=[],
        rationale=f"KI-Einschätzung derzeit nicht verfügbar: {reason}",
    )
