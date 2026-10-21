"""
api/metrics.py – /metrics/* endpoints.
"""

import time
import psutil
from fastapi import APIRouter, Query
from app.database import get_connection
from app.services.pipeline import _get_history, _history
from app.statistics.engine import analyse_metric, has_enough_data
from app.database import get_setting

router = APIRouter(prefix="/metrics", tags=["metrics"])

# Number of logical CPUs – used to normalise per-process cpu_percent
_CPU_COUNT = max(psutil.cpu_count(logical=True) or 1, 1)


@router.get("/current")
def get_current_metrics():
    """Return the most recent system metric row + top processes + status."""
    conn = get_connection()

    row = conn.execute(
        "SELECT * FROM system_metric ORDER BY timestamp DESC LIMIT 1"
    ).fetchone()

    if not row:
        return {"status": "no_data", "metrics": None}

    # Top processes by CPU – exclude idle processes, deduplicate by PID
    ts = row["timestamp"]
    procs = conn.execute("""
        SELECT pid, name, cpu_percent, memory_percent, memory_bytes, threads,
               io_read_bytes, io_write_bytes
        FROM process_snapshot
        WHERE timestamp BETWEEN ? AND ?
          AND pid > 0
          AND LOWER(name) NOT LIKE '%idle%'
        GROUP BY pid
        HAVING timestamp = MAX(timestamp)
        ORDER BY cpu_percent DESC NULLS LAST
        LIMIT 15
    """, (ts - 6, ts + 1)).fetchall()

    # Build anomaly context for each key metric, including sample count
    from app.diagnosis.persistence import get_all_states
    persist_states = get_all_states()

    def _metric_context(name: str, current_val):
        hist = _get_history(name)
        base = {"has_baseline": False, "history_samples": len(hist)}
        if current_val is None or not has_enough_data(hist):
            return base
        zscore_thr = float(get_setting("zscore_threshold", "2.0"))
        pct_thr    = int(get_setting("percentile_threshold", "95"))
        stats = analyse_metric(current_val, hist, zscore_thr, pct_thr)
        stats["history_samples"] = len(hist)
        # Add persistence info
        ps = persist_states.get(name)
        if ps:
            stats["consecutive_anomalies"] = ps.consecutive_anomalies
            stats["is_sustained"]           = ps.is_sustained
        return stats

    cpu_ctx = _metric_context("cpu_percent",        row["cpu_percent"])
    ram_ctx = _metric_context("ram_percent",         row["ram_percent"])
    drd_ctx = _metric_context("disk_read_bytes",     row["disk_read_bytes"])
    net_ctx = _metric_context("network_recv_bytes",  row["network_recv_bytes"])

    # Overall status
    active_events = conn.execute(
        "SELECT severity FROM diagnosis_event WHERE status='active' ORDER BY created_at DESC LIMIT 1"
    ).fetchone()

    if active_events:
        sev = active_events["severity"]
        overall_status = "critical" if sev == "HIGH" else "warning"
    else:
        overall_status = "healthy"

    return {
        "timestamp":         row["timestamp"],
        "overall_status":    overall_status,
        "cpu_percent":       row["cpu_percent"],
        "cpu_user":          row["cpu_user"],
        "cpu_system":        row["cpu_system"],
        "cpu_iowait":        row["cpu_iowait"],
        "ram_used":          row["ram_used"],
        "ram_available":     row["ram_available"],
        "ram_percent":       row["ram_percent"],
        "disk_read_bytes":   row["disk_read_bytes"],
        "disk_write_bytes":  row["disk_write_bytes"],
        "network_sent_bytes": row["network_sent_bytes"],
        "network_recv_bytes": row["network_recv_bytes"],
        "cpu_context":       cpu_ctx,
        "ram_context":       ram_ctx,
        "disk_read_context": drd_ctx,
        "net_context":       net_ctx,
        "top_processes": [
            {
                **dict(p),
                # Normalise cpu_percent: psutil reports sum across all cores
                "cpu_percent": round((p["cpu_percent"] or 0) / _CPU_COUNT, 1),
            }
            for p in procs
        ],
        "baseline_sample_count": len(_get_history("cpu_percent")),
        "persistence_n": int(get_setting("persistence_n", "4")),
    }


@router.get("/history")
def get_metric_history(
    metric: str = Query(..., description="Metric column name"),
    start:  float = Query(None, description="Unix timestamp start"),
    end:    float = Query(None, description="Unix timestamp end"),
    limit:  int   = Query(500),
):
    """Return historical rows for the given metric."""
    allowed = {
        "cpu_percent", "cpu_user", "cpu_system", "cpu_iowait",
        "ram_used", "ram_available", "ram_percent",
        "disk_read_bytes", "disk_write_bytes",
        "network_sent_bytes", "network_recv_bytes",
    }
    if metric not in allowed:
        return {"error": f"Unknown metric: {metric}"}

    conn = get_connection()
    now  = time.time()
    end   = end   or now
    start = start or (now - 3600)

    rows = conn.execute(f"""
        SELECT timestamp, {metric} as value
        FROM system_metric
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
        LIMIT ?
    """, (start, end, limit)).fetchall()

    return {
        "metric": metric,
        "start":  start,
        "end":    end,
        "data":   [{"timestamp": r["timestamp"], "value": r["value"]} for r in rows],
    }


@router.get("/stats/{metric}")
def get_metric_stats(metric: str):
    """Return full statistical context for a metric."""
    allowed = {
        "cpu_percent", "ram_percent", "disk_read_bytes",
        "disk_write_bytes", "network_sent_bytes", "network_recv_bytes",
    }
    if metric not in allowed:
        return {"error": f"Unknown metric: {metric}"}

    conn = get_connection()
    row  = conn.execute(
        f"SELECT timestamp, {metric} FROM system_metric ORDER BY timestamp DESC LIMIT 1"
    ).fetchone()

    if not row or row[metric] is None:
        return {"has_baseline": False}

    hist = _get_history(metric)
    zscore_thr = float(get_setting("zscore_threshold", "2.0"))
    pct_thr    = int(get_setting("percentile_threshold", "95"))
    stats = analyse_metric(row[metric], hist, zscore_thr, pct_thr)
    stats["current"] = row[metric]
    stats["metric"]  = metric
    return stats
