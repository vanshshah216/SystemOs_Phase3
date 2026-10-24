"""
main.py – SYSTEMOS FastAPI application entry point.

Starts the telemetry collector on startup and exposes all API routers.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database         import init_db
from app.collector.telemetry import start_collector, stop_collector
from app.api.metrics      import router as metrics_router
from app.api.processes    import router as processes_router
from app.api.applications import router as applications_router
from app.api.events       import router as events_router
from app.api.health       import router as health_router
from app.api.settings     import router as settings_router
from app.api.demo         import router as demo_router
from app.api.browser_activity import router as browser_activity_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s – %(message)s",
)
logger = logging.getLogger("systemos")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    logger.info("SYSTEMOS starting up...")
    init_db()
    start_collector()
    yield
    # ── Shutdown ──
    logger.info("SYSTEMOS shutting down...")
    stop_collector()


app = FastAPI(
    title="SYSTEMOS",
    description="Statistical Performance Monitoring and Root-Cause Diagnosis",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow the Next.js dev server (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(metrics_router)
app.include_router(applications_router)
app.include_router(processes_router)
app.include_router(events_router)
app.include_router(health_router)
app.include_router(settings_router)
app.include_router(demo_router)
app.include_router(browser_activity_router)


@app.get("/")
def root():
    return {
        "name":    "SYSTEMOS",
        "version": "1.0.0",
        "docs":    "/docs",
    }
