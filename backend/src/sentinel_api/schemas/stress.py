"""stress/* schemas (API_CONTRACT.md §2.10, §2.12).

StressReplayOut/ScenarioPresetOut are 1:1 re-exports of the core result
models — contract and core stay the same object, so they cannot drift.
"""

from __future__ import annotations

from pydantic import BaseModel

from sentinel_api.schemas.common import PortfolioIn
from sentinel_core.stress.replay import ScenarioPreset as ScenarioPresetOut
from sentinel_core.stress.replay import StressReplayResult as StressReplayOut

__all__ = [
    "ScenarioPresetOut",
    "StressPresetsOut",
    "StressReplayIn",
    "StressReplayOut",
]


class StressReplayIn(BaseModel):
    portfolio: PortfolioIn
    preset_id: str


class StressPresetsOut(BaseModel):
    presets: list[ScenarioPresetOut]
