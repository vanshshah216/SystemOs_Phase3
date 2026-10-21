"""
api/processes.py – /processes/* endpoints.
Includes standard process listings, deep Process Analyzer, recommendations,
category breakdowns, and per-process analysis.
"""

import time
from typing import Optional

import psutil
from fastapi import APIRouter, HTTPException, Query

from app.database import get_connection
from app.diagnosis.process_analyzer import (
    analyze_processes,
    inspect_live_process,
    generate_recommendations,
)

router = APIRouter(prefix="/processes", tags=["processes"])

_CPU_COUNT = max(psutil.cpu_count(logical=True) or 1, 1)


@router.get("")
def get_processes(
    sort_by: str = Query("cpu_percent", description="cpu_percent | memory_bytes | io"),
    limit: int = Query(50),
):
    """Return current process list, sorted by the specified field. Excludes PID 0."""
    conn = get_connection()
    latest = conn.execute(
        "SELECT MAX(timestamp) as ts FROM process_snapshot WHERE is_demo=0"
    ).fetchone()
    if not latest or not latest["ts"]:
        return {"processes": []}

    ts = latest["ts"]
    order = {
        "cpu_percent": "cpu_percent DESC NULLS LAST",
        "memory_bytes": "memory_bytes DESC NULLS LAST",
        "io": "(COALESCE(io_read_bytes,0)+COALESCE(io_write_bytes,0)) DESC",
    }.get(sort_by, "cpu_percent DESC NULLS LAST")

    rows = conn.execute(f"""
        SELECT pid, name, cpu_percent, memory_percent, memory_bytes,
               threads, io_read_bytes, io_write_bytes
        FROM process_snapshot
        WHERE timestamp BETWEEN ? AND ? 
          AND is_demo = 0 
          AND pid > 0
          AND LOWER(name) NOT LIKE '%idle%'
        GROUP BY pid
        HAVING timestamp = MAX(timestamp)
        ORDER BY {order}
        LIMIT ?
    """, (ts - 5, ts + 1, limit)).fetchall()

    # Normalise cpu_percent per-core
    result = []
    for r in rows:
        d = dict(r)
        if d["cpu_percent"] is not None:
            d["cpu_percent"] = round(d["cpu_percent"] / _CPU_COUNT, 1)
        result.append(d)

    return {"processes": result}


# ── Phase 3 Process Analyzer Endpoints ─────────────────────────────────────────

@router.get("/analyzer")
def get_process_analyzer(
    sort_by: str = Query("cpu_percent", description="cpu_percent | memory_bytes | memory_mb | runtime_seconds | open_connections"),
    limit: int = Query(50, ge=1, le=200),
    category: Optional[str] = Query(None, description="active_application | high_resource_consumer | background_process | protected_system_process | review_candidate | insufficient_information"),
    safety: Optional[str] = Query(None, description="protected_system | review_with_caution | safe_to_review | uncertain"),
    search: Optional[str] = Query(None, description="Process name or PID query filter"),
):

    """
    Return comprehensive process analysis:
      - Process profiles with activity classification, safety tiers, runtime, PPID
      - Historical CPU & memory trends with regression slope
      - Network socket metrics (active TCP/UDP connections count)
      - Summary statistics and category distribution
      - Intelligent recommendations for unnecessary / high-resource applications
    """
    return analyze_processes(
        sort_by=sort_by,
        limit=limit,
        category=category,
        safety=safety,
        search=search,
    )


@router.get("/recommendations")
def get_recommendations(
    limit: int = Query(20, ge=1, le=100),
):
    """
    Return prioritized, explainable recommendations for reviewing or terminating
    unnecessary, dormant, or resource-heavy applications.
    """
    analysis = analyze_processes(limit=100)
    recs = analysis.get("recommendations", [])[:limit]
    return {
        "count": len(recs),
        "potential_reclaimable_memory_mb": round(
            sum(r["reclaimable_memory_mb"] for r in recs), 1
        ),
        "recommendations": recs,
    }


@router.get("/categories")
def get_categories():
    """
    Return summary breakdown of processes by activity class:
    counts, aggregated memory, and average CPU per class.
    """
    analysis = analyze_processes(limit=1)
    return {
        "categories_breakdown": analysis.get("categories_breakdown", {}),
        "summary": analysis.get("summary", {}),
    }


# ── Per-PID Endpoints ──────────────────────────────────────────────────────────

@router.get("/{pid}/analysis")
def get_single_process_analysis(pid: int):
    """
    Return deep telemetry profile for a specific PID:
      - Identity, PPID, parent process name
      - Status, create_time, runtime
      - Normalized CPU, RAM RSS/VMS, Disk I/O
      - Open TCP/UDP connections and ports
      - Activity classification and safety tier
      - Historical trend slope and growth
      - Specific recommendations targeting this PID
    """
    profile = inspect_live_process(pid)
    if not profile or not profile.get("is_accessible"):
        raise HTTPException(
            status_code=404,
            detail=f"Process with PID {pid} is not running or is inaccessible.",
        )

    # Evaluate recommendations for this process specifically
    recs = generate_recommendations([profile])

    return {
        "profile": profile,
        "recommendations": recs,
    }


@router.get("/{pid}/history")
def get_process_history(
    pid:   int,
    start: float = Query(None),
    end:   float = Query(None),
    limit: int   = Query(300),
):
    """Return historical snapshots for a specific PID, normalised."""
    conn = get_connection()
    now   = time.time()
    end   = end   or now
    start = start or (now - 3600)

    rows = conn.execute("""
        SELECT timestamp, pid, name, cpu_percent, memory_percent,
               memory_bytes, threads, io_read_bytes, io_write_bytes
        FROM process_snapshot
        WHERE pid=? AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
        LIMIT ?
    """, (pid, start, end, limit)).fetchall()

    history = []
    for r in rows:
        d = dict(r)
        if d["cpu_percent"] is not None:
            d["cpu_percent"] = round(d["cpu_percent"] / _CPU_COUNT, 1)
        history.append(d)

    return {
        "pid":     pid,
        "history": history,
    }
