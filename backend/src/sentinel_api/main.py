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


# Reihenfolge ist bewusst und NICHT die Reihenfolge, in der die Middleware
# den Request tatsächlich sieht: Starlette registriert jede add_middleware()-
# bzw. @app.middleware()-Schicht an Position 0 der internen Liste, d.h. die
# ZULETZT registrierte Schicht wird zur ÄUSSERSTEN und läuft zuerst.
# CORSMiddleware beantwortet OPTIONS-Preflight-Requests intern selbst und
# reicht sie NICHT an app weiter (starlette/middleware/cors.py) — das
# funktioniert aber nur, wenn CORS die äußerste Schicht ist. Bug, der das
# hier auslöste: CORS wurde zuerst registriert (damit innerste Schicht),
# TrustedHostMiddleware lief also VOR CORS. Ein Host-Mismatch in Produktion
# (TRUSTED_HOSTS gesetzt) lieferte dann einen nackten 400 "Invalid host
# header" OHNE CORS-Header aus — der Browser wertet das als fehlgeschlagenen
# Preflight und bricht jeden nachfolgenden POST an /paper/* etc. ab, bevor
# überhaupt eine echte Anfrage rausgeht. Fix: CORSMiddleware zuletzt
# registrieren, damit sie zuverlässig als erste Schicht jeden Request sieht.


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Global body cap (security audit F1). Header-based: bodies without
    Content-Length (chunked) pass here and are bounded by the reverse
    proxy at deployment (see ARCHITECTURE §8 deploy checklist)."""
    # OPTIONS-Preflight-Requests haben typischerweise keinen Body und oft
    # gar keinen Content-Length-Header — ungeprüft durchlassen. Läuft CORS
    # korrekt als äußerste Schicht, sieht diese Middleware echte Browser-
    # Preflights ohnehin nie (CORSMiddleware beantwortet sie vorher direkt);
    # dieser Bypass ist die zusätzliche, explizit angeforderte Absicherung.
    if request.method == "OPTIONS":
        return await call_next(request)

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


# F8: ohne TRUSTED_HOSTS in Produktion bleibt das Default "*" (keine
# Einschränkung) — sobald die echte Domain als Env-Var gesetzt ist,
# greift die Beschränkung, ohne dass ein Redeploy den lokalen Betrieb
# (Host-Header "localhost") bricht.
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=_split_env_list("TRUSTED_HOSTS", _DEFAULT_TRUSTED_HOSTS),
)

# Zuletzt registriert = äußerste Schicht (s. Kommentar oben) — muss JEDE
# Anfrage als Erstes sehen, damit Preflights immer korrekt beantwortet
# werden, egal was TrustedHost/Body-Limit dahinter tun würden.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_split_env_list("ALLOWED_ORIGINS", _DEFAULT_ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)


register_error_handlers(app)
app.include_router(paper_router)
app.include_router(risk_router)
app.include_router(stress_router)
app.include_router(simulation_router)
app.include_router(portfolio_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
