"""stress/* routes (API_CONTRACT.md §2.10, §2.12).

Both routes are the single-call ideal from paper.py: replay() and
get_preset() already return exactly the contract shape.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter

from sentinel_api.schemas.stress import (
    StressPresetsOut,
    StressReplayIn,
    StressReplayOut,
)
from sentinel_core.constants import STRESS_PRESETS
from sentinel_core.stress.replay import DEFAULT_CACHE_DIR, get_preset, replay

router = APIRouter(prefix="/stress", tags=["stress"])

# F5: optional override for deploy targets with a read-only or ephemeral
# filesystem at the default location (Railway/Render, ARCHITECTURE §8).
# core stays env-free; only the API layer reads the environment.
_CACHE_DIR = (
    Path(os.environ["STRESS_CACHE_DIR"])
    if os.environ.get("STRESS_CACHE_DIR")
    else DEFAULT_CACHE_DIR
)


@router.post("/replay", response_model=StressReplayOut)
def post_stress_replay(body: StressReplayIn) -> StressReplayOut:
    return replay(body.portfolio.weights, body.preset_id, cache_dir=_CACHE_DIR)


@router.get("/presets", response_model=StressPresetsOut)
def get_stress_presets() -> StressPresetsOut:
    presets = [get_preset(preset_id) for preset_id in STRESS_PRESETS]
    return StressPresetsOut(presets=presets)
