"""Smoke tests: packages import, constants are consistent, API responds."""

import math

from fastapi.testclient import TestClient

from sentinel_api.main import app
from sentinel_core import constants


def test_score_weights_sum_to_one() -> None:
    total = (
        constants.SCORE_WEIGHT_VOLATILITY
        + constants.SCORE_WEIGHT_MAX_DRAWDOWN
        + constants.SCORE_WEIGHT_VAR
        + constants.SCORE_WEIGHT_CVAR
        + constants.SCORE_WEIGHT_CONCENTRATION
    )
    assert math.isclose(total, 1.0)


def test_ampel_thresholds_are_ordered() -> None:
    assert constants.AMPEL_HHI_GREEN_MAX < constants.AMPEL_HHI_YELLOW_MAX
    assert constants.AMPEL_DR_YELLOW_MIN < constants.AMPEL_DR_GREEN_MIN
    assert constants.AMPEL_VOL_GREEN_MAX < constants.AMPEL_VOL_YELLOW_MAX


def test_sentiment_deltas_are_asymmetric() -> None:
    # Negative sentiment must weigh more than positive (conservative principle).
    deltas = constants.SENTIMENT_SCORE_DELTA
    assert deltas[-2] > abs(deltas[2])
    assert deltas[-1] > abs(deltas[1])
    assert deltas[0] == 0


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
