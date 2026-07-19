"""LLM client with graceful degradation (KNOWLEDGE_EXTRACTION.md §8).

Two gates sit in front of ANY real API call:

1. The SENTINEL_AI_ENABLED feature flag (default OFF) — a cost guard for
   a public repo: a stray local key or a CI run must never trigger paid
   API calls without deliberate opt-in. Checked in assess_market BEFORE
   the provider is even constructed.
2. The ANTHROPIC_API_KEY presence, checked inside the provider.

The cascade pattern is unchanged from §8: unavailability raises
RuntimeError, invalid model output raises ValueError, and the public
entry point (risk_adjustment.assess_market) catches everything and
degrades to a neutral, usable result. No LLM failure may ever take down
score or Ampel (ARCHITECTURE §1, principle 2).

Provider abstraction: LLMProvider is a small protocol so the concrete
API binding can change without touching the cascade. The default
AnthropicProvider uses Claude Haiku with a FORCED tool call — the strict
JSON structure comes from the tool's input schema instead of prompt
begging. validate_market_context still re-checks every field: the model
remains untrusted regardless of how the payload was produced (§8).

Configuration is environment-only: SENTINEL_AI_ENABLED (opt-in flag),
ANTHROPIC_API_KEY (key), SENTINEL_LLM_MODEL (optional model override).
No keys in code; nothing loads .env files in v1 — variables must be set
in the process environment (see backend/.env.example for reference).
"""

from __future__ import annotations

import os
from typing import Protocol

from pydantic import BaseModel, ConfigDict

# Consistency over creativity (§8).
_TEMPERATURE = 0.2
_MAX_TOKENS = 1024
_SYSTEM_ROLE = "You are a risk analyst for a German retail investing education app."
# Haiku: cheapest current Claude tier — right-sized for a 25-headline
# sentiment call. Overridable via env without a code change.
_DEFAULT_MODEL = "claude-haiku-4-5-20251001"

# Forced tool call = structural JSON guarantee from the API side. The
# schema mirrors validate_market_context; validation still re-checks
# everything because tool inputs are model-generated, not API-verified.
_MARKET_CONTEXT_TOOL = {
    "name": "report_market_context",
    "description": (
        "Report the market risk assessment derived from the headlines "
        "in structured form."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "sentiment": {
                "type": "integer",
                "minimum": -2,
                "maximum": 2,
                "description": "Overall market sentiment, -2 (very bearish) to +2.",
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Confidence in the sentiment call, 0..1.",
            },
            "bullets": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 5,
                "description": (
                    "3-5 German bullet points describing market "
                    "conditions and risks. NEVER recommendations for "
                    "individual securities."
                ),
            },
        },
        "required": ["sentiment", "confidence", "bullets"],
    },
}


def ai_enabled() -> bool:
    """Feature flag SENTINEL_AI_ENABLED — default OFF (cost guard).

    Only an explicit "true"/"1" enables AI features; anything else,
    including an unset variable, keeps them off even when a valid
    API key happens to be present in the environment.
    """
    return os.environ.get("SENTINEL_AI_ENABLED", "").strip().lower() in {
        "true",
        "1",
    }


class LLMProvider(Protocol):
    """Thin provider seam: produce the raw market-context payload.

    Implementations raise RuntimeError when the feature is unavailable
    (missing key/package) and may raise anything on transport errors —
    the cascade in assess_market catches it all.
    """

    def generate(self, prompt: str) -> dict: ...


class AnthropicProvider:
    """Default provider: Claude Haiku via the Anthropic API."""

    def generate(self, prompt: str) -> dict:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "Kein LLM-API-Key gesetzt (Umgebungsvariable "
                "ANTHROPIC_API_KEY) – KI-Funktionen sind deaktiviert."
            )
        try:
            # Lazy import: anthropic stays an OPTIONAL dependency; a
            # missing package must not break importing the app (§8).
            from anthropic import Anthropic
        except ImportError as exc:
            raise RuntimeError(
                "Das Paket 'anthropic' ist nicht installiert – "
                "KI-Funktionen sind deaktiviert."
            ) from exc

        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.environ.get("SENTINEL_LLM_MODEL", _DEFAULT_MODEL),
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
            system=_SYSTEM_ROLE,
            messages=[{"role": "user", "content": prompt}],
            tools=[_MARKET_CONTEXT_TOOL],
            # Forcing the tool call makes free-text answers impossible.
            tool_choice={"type": "tool", "name": "report_market_context"},
        )
        for block in response.content:
            if block.type == "tool_use":
                return dict(block.input)
        raise ValueError("Leere LLM-Antwort (kein Tool-Aufruf).")


class MarketContext(BaseModel):
    """Validated LLM market assessment — feeds the score, must be strict."""

    model_config = ConfigDict(frozen=True)

    sentiment: int  # -2 .. +2
    confidence: float  # 0 .. 1
    bullets: list[str]  # 3 .. 5, German


def validate_market_context(payload: dict) -> MarketContext:
    """STRICT validation (§8): sentiment in [-2, 2], confidence in
    [0, 1], at least 3 bullets, more than 5 are cut. Every failure is
    bundled into one ValueError so the caller can fall back instead of
    passing broken LLM output through. Tool use guarantees a dict shape,
    NOT correct values — the model stays untrusted."""
    try:
        sentiment = int(payload["sentiment"])
        confidence = float(payload["confidence"])
        bullets = [str(b) for b in payload["bullets"]]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"LLM-Antwort nicht parsebar: {exc}") from exc

    if not -2 <= sentiment <= 2:
        raise ValueError(f"Sentiment außerhalb von [-2, 2]: {sentiment}.")
    if not 0 <= confidence <= 1:
        raise ValueError(f"Confidence außerhalb von [0, 1]: {confidence}.")
    if len(bullets) < 3:
        raise ValueError(
            f"Zu wenige Bullets in der LLM-Antwort ({len(bullets)}), "
            "mindestens 3 erwartet."
        )
    return MarketContext(
        sentiment=sentiment, confidence=confidence, bullets=bullets[:5]
    )
