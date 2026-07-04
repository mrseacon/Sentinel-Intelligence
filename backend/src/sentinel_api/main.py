"""FastAPI entry point. Run locally: uvicorn sentinel_api.main:app --reload"""

from fastapi import FastAPI

app = FastAPI(title="Sentinel API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
