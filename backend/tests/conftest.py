"""Test-wide setup, imported by pytest before any test module.

All TestClient requests come from one address, so the global per-IP rate
limit (sentinel_api/rate_limit.py) would throttle the suite after ~120
requests. It is switched off here; the limiter itself is covered by
test_rate_limit.py against its own small app.
"""

import os

os.environ.setdefault("SENTINEL_RATE_LIMIT_PER_MINUTE", "0")
