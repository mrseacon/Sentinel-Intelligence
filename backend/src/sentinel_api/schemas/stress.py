"""stress/* schemas (API_CONTRACT.md §2.10, §2.12).

StressReplayOut/ScenarioPresetOut are 1:1 re-exports of the core result
models — contract and core stay the same object, so they cannot drift.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from sentinel_api.schemas.common import LANG_DESCRIPTION, PortfolioIn
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
    lang: str = Field(default="de", description=LANG_DESCRIPTION)


class StressPresetsOut(BaseModel):
    presets: list[ScenarioPresetOut]
