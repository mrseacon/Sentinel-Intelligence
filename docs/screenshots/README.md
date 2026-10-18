# README screenshots

English demo (`/en`, `?demo=1`), viewport 1280x800, light and dark.
The risk traffic light page is captured full-page so the correlation
heatmap is included. Not part of CI; regenerate manually when the UI changes.

`capture.mjs` uses the Playwright already installed in `frontend/`
(no extra dependency). Local servers only, never the live URL:

```bash
# terminal 1: backend
cd backend && source .venv/bin/activate
SENTINEL_RATE_LIMIT_PER_MINUTE=0 PYTHONPATH=src uvicorn sentinel_api.main:app --port 8000

# terminal 2: frontend (production build)
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build && npm run start

# terminal 3: capture (from the repo root)
node docs/screenshots/capture.mjs
```

Output: `{depot,traffic-light,stress-test,simulation}-{light,dark}.png` in this
folder. Market data comes from yfinance, so numbers shift slightly between runs.
