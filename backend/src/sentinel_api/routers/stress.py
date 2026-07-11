"""stress/* routes (API_CONTRACT.md §2.10, §2.12).

Both routes are the single-call ideal from paper.py: replay() and
get_preset() already return exactly the contract shape.
"""

from __future__ import annotations

from fastapi import APIRouter

from sentinel_api.schemas.stress import (
    StressPresetsOut,
    StressReplayIn,
    StressReplayOut,
)
from sentinel_core.constants import STRESS_PRESETS
from sentinel_core.stress.replay import get_preset, replay

router = APIRouter(prefix="/stress", tags=["stress"])


@router.post("/replay", response_model=StressReplayOut)
def post_stress_replay(body: StressReplayIn) -> StressReplayOut:
    return replay(body.portfolio.weights, body.preset_id)


@router.get("/presets", response_model=StressPresetsOut)
def get_stress_presets() -> StressPresetsOut:
    presets = [get_preset(preset_id) for preset_id in STRESS_PRESETS]
    return StressPresetsOut(presets=presets)
