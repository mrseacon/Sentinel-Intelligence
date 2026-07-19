"""Deterministic, asymmetric AI risk adjustment (KNOWLEDGE_EXTRACTION.md §7).

Transparent rules, NOT a black box: sentiment maps to a fixed score
delta from constants.py — negative news raise the score more (+4/+8)
than positive news lower it (-3/-6), a conservative risk principle. The
delta is scaled by the LLM's confidence and rounded to int: low
confidence means little influence.

assess_market is the public, NEVER-raising entry point. Order of gates:

1. SENTINEL_AI_ENABLED feature flag (cost guard, default OFF) — checked
   BEFORE any provider/key logic, so a stray key can never trigger a
   paid call without deliberate opt-in.
2. Provider cascade (§8): missing key/package (RuntimeError), transport
   errors, invalid payloads (ValueError) — everything degrades to a
   neutral assessment.

The user-facing `rationale` is the SAME friendly German text for every
unavailability cause; the technical cause lives in `unavailable_reason`
(debugging only, never shown to users) so flag-off is distinguishable
from key-missing. LLM bullets pass the principle-3 guardrail before
they reach the result.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from sentinel_core.ai.guardrails import filter_llm_bullets
from sentinel_core.ai.llm_client import (
    AnthropicProvider,
    LLMProvider,
    ai_enabled,
    validate_market_context,
)
from sentinel_core.constants import SENTIMENT_SCORE_DELTA
from sentinel_core.errors import SentinelError

# One friendly text for EVERY unavailability cause — users should not
# have to care whether a flag, a key or a timeout was responsible.
_UNAVAILABLE_TEXT = "KI-Einschätzung derzeit nicht verfügbar."

# Debug reason when the feature flag (not a failure) is the cause.
FLAG_DISABLED_REASON = (
    "KI-Funktion per Feature-Flag deaktiviert (SENTINEL_AI_ENABLED ist "
    "nicht 'true') – Kostenschranke für das öffentliche Repo."
)


class AiAssessment(BaseModel):
    """Always-usable result: neutral (delta 0) when the LLM is unavailable."""

    model_config = ConfigDict(frozen=True)

    available: bool
    sentiment: int
    confidence: float
    score_delta: int
    bullets: list[str]
    rationale: str  # user-facing German (§7: rationale is part of the contract)
    # Technical cause when available=False (flag off, key missing,
    # timeout, parse error). Debugging/logging only — never shown in UI.
    unavailable_reason: str | None = None


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


def assess_market(
    headlines: list[str], provider: LLMProvider | None = None
) -> AiAssessment:
    """LLM market assessment with full graceful degradation.

    Never raises. The feature flag is checked FIRST: without explicit
    opt-in, no provider is constructed, no key is read, no request
    leaves the machine. Tests inject a fake `provider`; production uses
    the AnthropicProvider default.
    """
    if not ai_enabled():
        return _neutral(FLAG_DISABLED_REASON)

    try:
        active = provider if provider is not None else AnthropicProvider()
        payload = active.generate(_build_prompt(headlines))
        context = validate_market_context(payload)
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
    # No JSON begging: the structure is enforced by the forced tool call
    # (llm_client). The prompt only carries task + principle-3 rule.
    joined = "\n".join(f"- {headline}" for headline in headlines)
    return (
        "Bewerte das aktuelle Marktrisiko anhand der folgenden "
        "Schlagzeilen und melde das Ergebnis über das Tool "
        "'report_market_context'. Die Stichpunkte beschreiben Marktlage "
        "und Risiken auf Deutsch, niemals Empfehlungen zu einzelnen "
        "Wertpapieren.\n\n"
        f"Schlagzeilen:\n{joined}"
    )


def _neutral(reason: str) -> AiAssessment:
    return AiAssessment(
        available=False,
        sentiment=0,
        confidence=0.0,
        score_delta=0,
        bullets=[],
        rationale=_UNAVAILABLE_TEXT,
        unavailable_reason=reason,
    )
