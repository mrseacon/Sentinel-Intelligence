"""FastAPI entry point.

Run locally: PYTHONPATH=src uvicorn sentinel_api.main:app --reload

Composition only: routers hold the wiring, sentinel_core holds the
logic, errors.py holds the {detail, code} convention (API_CONTRACT.md).
Adding a domain = one schemas file + one router file + include_router.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sentinel_api.errors import register_error_handlers
from sentinel_api.routers.paper import router as paper_router

app = FastAPI(title="Sentinel API", version="0.1.0")

# Phase 1: local Next.js dev server only (ARCHITECTURE §8).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(paper_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
