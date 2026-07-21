"""FastAPI entry point.

Run locally: PYTHONPATH=src uvicorn sentinel_api.main:app --reload

Composition only: routers hold the wiring, sentinel_core holds the
logic, errors.py holds the {detail, code} convention (API_CONTRACT.md).
Adding a domain = one schemas file + one router file + include_router.
"""

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from sentinel_api.errors import register_error_handlers
from sentinel_api.limits import MAX_BODY_BYTES
from sentinel_api.routers.paper import router as paper_router
from sentinel_api.routers.portfolio import router as portfolio_router
from sentinel_api.routers.risk import router as risk_router
from sentinel_api.routers.simulation import router as simulation_router
from sentinel_api.routers.stress import router as stress_router

app = FastAPI(title="Sentinel API", version="0.1.0")

# Deploy-Checkliste (ARCHITECTURE §8): CORS-Origins und vertrauenswürdige
# Hosts sind über die Prozess-Umgebung konfigurierbar, damit dieselbe
# main.py lokal (localhost:3000) und in Produktion (echte Vercel-Domain)
# läuft, ohne Code zu ändern. Kommagetrennt, da beide Deploy-Ziele
# (Railway/Render) Env-Vars als einfache Strings setzen.
_DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"]
_DEFAULT_TRUSTED_HOSTS = ["*"]  # Phase 1 default: erst TRUSTED_HOSTS schränkt ein


def _split_env_list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if not raw:
        return default
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values or default


app.add_middleware(
    CORSMiddleware,
    allow_origins=_split_env_list("ALLOWED_ORIGINS", _DEFAULT_ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

# F8: ohne TRUSTED_HOSTS in Produktion bleibt das Default "*" (keine
# Einschränkung) — sobald die echte Domain als Env-Var gesetzt ist,
# greift die Beschränkung, ohne dass ein Redeploy den lokalen Betrieb
# (Host-Header "localhost") bricht.
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_split_env_list("TRUSTED_HOSTS", _DEFAULT_TRUSTED_HOSTS),
)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Global body cap (security audit F1). Header-based: bodies without
    Content-Length (chunked) pass here and are bounded by the reverse
    proxy at deployment (see ARCHITECTURE §8 deploy checklist)."""
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            too_large = int(content_length) > MAX_BODY_BYTES
        except ValueError:
            too_large = False  # malformed header: let the parser reject it
        if too_large:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": (
                        f"Anfrage zu groß (maximal "
                        f"{MAX_BODY_BYTES // 1_000_000} MB)."
                    ),
                    "code": "PAYLOAD_TOO_LARGE",
                },
            )
    return await call_next(request)


register_error_handlers(app)
app.include_router(paper_router)
app.include_router(risk_router)
app.include_router(stress_router)
app.include_router(simulation_router)
app.include_router(portfolio_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
