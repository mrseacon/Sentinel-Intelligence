"""Principle-3 guardrail for LLM-generated text (ARCHITECTURE §1).

Internal templates are trusted and covered by the test-side regression
guard; LLM output is NOT trustworthy in the same way. Any generated
bullet containing an action-verb stem about trading is dropped before
it reaches the user — legally safer to lose a bullet than to show a
sentence a reader could take as investment advice.

The stem list deliberately over-blocks (plain substring match: "sell"
also hits "sell-off", "short" also hits "shortage"). Accepted trade-off:
a dropped descriptive bullet costs little, a passed recommendation is
the one failure mode this app must never have.
"""

from __future__ import annotations

# German + English stems; checked lowercase, substring semantics.
ACTION_VERB_STEMS = (
    "kauf",  # also covers "verkauf"
    "verkauf",
    "abstoß",
    "abstoss",
    "veräußer",
    "aufstock",
    "reduzier",
    "umschicht",
    "nachleg",
    "trenn dich",
    "buy",
    "sell",
    "short",
    "accumulate",
    "add exposure",
    "take profit",
    "trim",
    "overweight",
    "underweight",
)


def contains_action_verb(text: str) -> bool:
    lowered = text.lower()
    return any(stem in lowered for stem in ACTION_VERB_STEMS)


def filter_llm_bullets(bullets: list[str]) -> list[str]:
    """Drop every LLM bullet that contains an action-verb stem."""
    return [bullet for bullet in bullets if not contains_action_verb(bullet)]
