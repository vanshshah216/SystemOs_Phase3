"""
api/health.py – /health endpoint.
Provides real-time operational status for all SYSTEMOS monitoring pipeline components.
"""

import time
import logging
from fastapi import APIRouter
from app.database import get_connection, get_setting
from app.collector.telemetry import get_collector_status, collect_once
from app.services.pipeline import get_current_anomalies

router = APIRouter(tags=["health"])
logger = logging.getLogger("systemos.health")


@router.get("/health")
def health_check():
    # 1. Database check & snapshot count
    db_ok = False
    snapshot_count = 0
    wal_mode = False
    try:
        conn = get_connection()
        cur = conn.execute("SELECT 1")
        db_ok = True
        count_row = conn.execute(
            """SELECT COUNT(*) as cnt
               FROM process_snapshot
               WHERE is_demo=0
                 AND timestamp=(
                     SELECT MAX(timestamp) FROM process_snapshot WHERE is_demo=0
                 )"""
        ).fetchone()
        snapshot_count = count_row["cnt"] if count_row else 0
        pragma_row = conn.execute("PRAGMA journal_mode").fetchone()
        wal_mode = pragma_row[0].lower() == "wal" if pragma_row else False
    except Exception:
        logger.exception("Health check could not query the database")

    # 2. Telemetry Collector Daemon check
    collector = get_collector_status()
    collector_running = bool(collector.get("running"))
    last_collection = collector.get("last_collection_time")
    collector_age = None if last_collection is None else max(0.0, time.time() - last_collection)
    try:
        stale_after = max(60.0, float(get_setting("sampling_interval", "3")) * 5)
    except (TypeError, ValueError):
        logger.exception("Invalid sampling_interval setting during health check")
        stale_after = 60.0
    collector_healthy = collector_running and (
        collector_age is not None and collector_age < stale_after
    )

    # 3. Pipeline & Statistical Engine check
    try:
        get_current_anomalies()
        stats_engine_ok = True
    except Exception:
        logger.exception("Health check could not query current diagnosis state")
        stats_engine_ok = False

    components = {
        "telemetry_collector": {
            "name": "Live Telemetry Collector",
            "status": "operational" if collector_healthy else "degraded" if collector_running else "stopped",
            "details": (
                f"psutil daemon sampling every {get_setting('sampling_interval', '3')}s "
                f"(last collected {int(collector_age)}s ago)"
                if last_collection
                else "Waiting for initial collection"
            ),
        },
        "database_storage": {
            "name": "SQLite Observability Store",
            "status": "operational" if db_ok else "down",
            "details": f"WAL mode: {wal_mode} | Processes in latest sample: {snapshot_count:,}",
        },
        "statistical_engine": {
            "name": "Statistical Engine",
            "status": "operational" if stats_engine_ok else "initializing",
            "details": "Rolling baseline z-score & percentile computation active",
        },
        "anomaly_detector": {
            "name": "Anomaly Detector & Persistence Tracker",
            "status": "operational",
            "details": "Threshold & trend regression state machines operational",
        },
        "process_analyzer": {
            "name": "Process Activity & Recommendation Engine",
            "status": "operational",
            "details": "6-tier canonical classifier and 7-dimension explainable recommendations",
        },
        "diagnosis_rules": {
            "name": "Root-Cause Diagnosis Rules (A–E)",
            "status": "operational",
            "details": "Deterministic multi-resource correlation & attribution",
        },
    }

    overall_ok = db_ok and collector_healthy and stats_engine_ok

    return {
        "status": "healthy" if overall_ok else "warning",
        "backend_status": "ok",
        "collector_running": collector_running,
        "database_ok": db_ok,
        "last_collection_time": last_collection,
        "collector_age_seconds": collector_age,
        "pipeline_health": {
            "overall_status": "operational" if overall_ok else "degraded",
            "components": components,
        },
    }


@router.post("/health/collect")
def trigger_collection():
    """
    Immediately collect system metrics and process snapshots, run the analysis pipeline,
    and invalidate the process analyzer cache.
    """
    result = collect_once(is_demo=False)
    return {"ok": True, **result}
