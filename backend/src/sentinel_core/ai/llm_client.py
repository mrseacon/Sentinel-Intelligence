"""LLM client with graceful degradation (KNOWLEDGE_EXTRACTION.md §8).

The fallback cascade is the core design pattern: missing API key,
missing optional openai package, timeouts and unparseable answers all
raise HERE — and the public entry point (risk_adjustment.assess_market)
catches everything and degrades to a neutral, usable result. No LLM
failure may ever take down score or Ampel (ARCHITECTURE §1, principle 2).

Configuration is environment-only: OPENAI_API_KEY (required for LLM
features), SENTINEL_LLM_MODEL (optional override). No keys in code.
"""

from __future__ import annotations

import json
import os

from pydantic import BaseModel, ConfigDict

from sentinel_core.errors import SentinelError

# Consistency over creativity (§8).
_TEMPERATURE = 0.2
_SYSTEM_ROLE = "You are a risk analyst for a German retail investing education app."
# Provider/model cascade is a Phase-2 decision (ARCHITECTURE §10); until
# then one model, overridable via environment without a code change.
_DEFAULT_MODEL = "gpt-4o-mini"


class MarketContext(BaseModel):
    """Validated LLM market assessment — feeds the score, must be strict."""

    model_config = ConfigDict(frozen=True)

    sentiment: int  # -2 .. +2
    confidence: float  # 0 .. 1
    bullets: list[str]  # 3 .. 5, German


def generate(prompt: str) -> str:
    """One LLM call. Raises RuntimeError when the feature is unavailable
    (no key, no package) — callers fall back, they never crash."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Kein LLM-API-Key gesetzt (Umgebungsvariable OPENAI_API_KEY) – "
            "KI-Funktionen sind deaktiviert."
        )
    try:
        # Lazy import: openai stays an OPTIONAL dependency; a missing
        # package must not break importing the app (§8).
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "Das Paket 'openai' ist nicht installiert – "
            "KI-Funktionen sind deaktiviert."
        ) from exc

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=os.environ.get("SENTINEL_LLM_MODEL", _DEFAULT_MODEL),
        temperature=_TEMPERATURE,
        messages=[
            {"role": "system", "content": _SYSTEM_ROLE},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content
    if not content:
        raise SentinelError("Leere LLM-Antwort.")
    return content


def parse_market_context(raw: str) -> MarketContext:
    """STRICT JSON validation (§8): sentiment in [-2, 2], confidence in
    [0, 1], at least 3 bullets, more than 5 are cut. Every parse or
    validation failure is bundled into one ValueError so the caller can
    fall back instead of passing broken LLM output through."""
    try:
        data = json.loads(raw)
        sentiment = int(data["sentiment"])
        confidence = float(data["confidence"])
        bullets = [str(b) for b in data["bullets"]]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise SentinelError(f"LLM-Antwort nicht parsebar: {exc}") from exc

    if not -2 <= sentiment <= 2:
        raise SentinelError(f"Sentiment außerhalb von [-2, 2]: {sentiment}.")
    if not 0 <= confidence <= 1:
        raise SentinelError(f"Confidence außerhalb von [0, 1]: {confidence}.")
    if len(bullets) < 3:
        raise SentinelError(
            f"Zu wenige Bullets in der LLM-Antwort ({len(bullets)}), "
            "mindestens 3 erwartet."
        )
    return MarketContext(
        sentiment=sentiment, confidence=confidence, bullets=bullets[:5]
    )
