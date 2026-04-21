"""
OtaruChain Partner Backend
Standalone FastAPI service — separate from the main OCR backend.
Shares the same Supabase DB.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.settings import CORS_ORIGINS

from api.apikeys import router as apikeys_router
from api.payment import router as payment_router
from api.stats import router as stats_router
from api.scoring import router as scoring_router

app = FastAPI(
    title="OtaruChain Partner API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ───────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"
app.include_router(apikeys_router, prefix=PREFIX)
app.include_router(payment_router, prefix=PREFIX)
app.include_router(stats_router, prefix=PREFIX)
app.include_router(scoring_router, prefix=PREFIX)


@app.get("/")
def root():
    return {"service": "OtaruChain Partner API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
