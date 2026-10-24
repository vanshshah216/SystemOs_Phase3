"""
diagnosis/attribution.py – Process ranking and attribution.

Given process snapshots from an event window, rank processes by the
relevant resource (CPU / memory / disk I/O) and identify the top contributor.
"""

import json
from typing import Optional

import psutil

from app.database import get_connection

_CPU_COUNT = max(psutil.cpu_count(logical=True) or 1, 1)


def _is_monitor_snapshot(s: dict) -> bool:
    if s.get("application_id") == "systemos-monitor":
        return True
    raw = s.get("identity_json")
    if raw:
        try:
            ident = json.loads(raw)
            return ident.get("role") == "monitor_runtime"
        except Exception:
            pass
    return False


def _display_label(s: dict) -> str:
    return s.get("display_name") or s.get("name") or "unknown"


def _get_process_snapshots_in_window(start_time: float, end_time: float, is_demo: bool = False) -> list[dict]:
    """Fetch all process snapshots between start and end timestamps."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT pid, name, cpu_percent, memory_percent, memory_bytes,
               io_read_bytes, io_write_bytes, threads,
               display_name, application_id, identity_json, create_time
        FROM process_snapshot
        WHERE timestamp BETWEEN ? AND ?
          AND is_demo = ?
        ORDER BY timestamp
    """, (start_time, end_time, 1 if is_demo else 0)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if _is_monitor_snapshot(d):
            continue
        out.append(d)
    return out


def _aggregate_by_pid(snapshots: list[dict], key: str) -> dict[tuple[int, int], dict]:
    """
    For each PID, compute the average of `key` across all snapshots.
    Also track the process name and max value.
    """
    aggregated: dict[tuple[int, int], dict] = {}
    for s in snapshots:
        pid  = s["pid"]
        create_time = s.get("create_time") or 0
        process_key = (pid, int(create_time))
        val  = s.get(key)
        name = _display_label(s)
        proc_name = s.get("name") or "unknown"
        if val is None:
            continue
        if process_key not in aggregated:
            aggregated[process_key] = {
                "pid": pid,
                "name": name,
                "process_name": proc_name,
                "application_id": s.get("application_id"),
                "create_time": create_time,
                "values": [],
                "max": 0.0,
            }
        aggregated[process_key]["values"].append(val)
        if val > aggregated[process_key]["max"]:
            aggregated[process_key]["max"] = val

    result = {}
    for process_key, agg in aggregated.items():
        if agg["values"]:
            agg["avg"] = sum(agg["values"]) / len(agg["values"])
        else:
            agg["avg"] = 0.0
        result[process_key] = agg
    return result


def rank_processes_by_cpu(start_time: float, end_time: float, is_demo: bool = False, top_n: int = 5) -> list[dict]:
    """Rank processes by average CPU usage in the window."""
    snaps = _get_process_snapshots_in_window(start_time, end_time, is_demo)
    agg   = _aggregate_by_pid(snaps, "cpu_percent")
    ranked = sorted(agg.values(), key=lambda x: x["avg"], reverse=True)
    result = _format_ranking(ranked[:top_n], "cpu_percent_avg")
    for item in result:
        item["avg_value"] = round(item["avg_value"] / _CPU_COUNT, 2)
        item["max_value"] = round(item["max_value"] / _CPU_COUNT, 2)
    return result


def rank_processes_by_memory(start_time: float, end_time: float, is_demo: bool = False, top_n: int = 5) -> list[dict]:
    """Rank processes by average memory usage in the window."""
    snaps = _get_process_snapshots_in_window(start_time, end_time, is_demo)
    agg   = _aggregate_by_pid(snaps, "memory_bytes")
    ranked = sorted(agg.values(), key=lambda x: x["avg"], reverse=True)
    return _format_ranking(ranked[:top_n], "memory_bytes_avg")


def rank_processes_by_disk_io(start_time: float, end_time: float, is_demo: bool = False, top_n: int = 5) -> list[dict]:
    """Rank processes by combined disk I/O in the window."""
    snaps = _get_process_snapshots_in_window(start_time, end_time, is_demo)
    # Build combined read+write
    combined: dict[tuple[int, int], dict] = {}
    for s in snaps:
        pid  = s["pid"]
        name = _display_label(s)
        r    = s.get("io_read_bytes")  or 0
        w    = s.get("io_write_bytes") or 0
        total = r + w
        create_time = s.get("create_time") or 0
        process_key = (pid, int(create_time))
        if process_key not in combined:
            combined[process_key] = {
                "pid": pid,
                "name": name,
                "process_name": s.get("name") or "unknown",
                "application_id": s.get("application_id"),
                "create_time": create_time,
                "values": [],
                "max": 0.0,
            }
        combined[process_key]["values"].append(total)
        if total > combined[process_key]["max"]:
            combined[process_key]["max"] = total
    for process_key, agg in combined.items():
        agg["avg"] = sum(agg["values"]) / len(agg["values"]) if agg["values"] else 0.0
    ranked = sorted(combined.values(), key=lambda x: x["avg"], reverse=True)
    return _format_ranking(ranked[:top_n], "io_bytes_avg")


def _format_ranking(ranked: list[dict], metric_key: str) -> list[dict]:
    out = []
    for rank, item in enumerate(ranked, 1):
        out.append({
            "rank":       rank,
            "pid":        item["pid"],
            "name":       item["name"],
            "process_name": item.get("process_name") or item["name"],
            "application_id": item.get("application_id"),
            "create_time": item.get("create_time"),
            "avg_value":  round(item["avg"], 2),
            "max_value":  round(item["max"], 2),
            "metric_key": metric_key,
        })
    return out


def get_top_contributor(ranking: list[dict]) -> Optional[str]:
    """Return the name of the top-ranked process, or None if empty."""
    if ranking:
        return ranking[0]["name"]
    return None
