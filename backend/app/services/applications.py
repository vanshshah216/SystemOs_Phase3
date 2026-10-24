"""
services/applications.py – Live application enumeration and grouping for API consumers.
"""

from __future__ import annotations

import logging
import json
import time
from typing import Any, Optional

from app.collector.app_identity import (
    ProcessIdentity,
    aggregate_identities_to_applications,
)
from app.database import get_connection
from app.diagnosis.process_analyzer import get_foreground_process_info, _CPU_COUNT

logger = logging.getLogger("systemos.applications")

IDLE_SUGGESTION_SECONDS = 60 * 60


def record_foreground_application(snapshots: list[dict[str, Any]], timestamp: float) -> None:
    """Persist the recognized user app observed in the foreground for this sample."""
    foreground_pid, _ = get_foreground_process_info()
    if foreground_pid is None:
        return

    foreground = next(
        (snapshot for snapshot in snapshots if snapshot.get("pid") == foreground_pid),
        None,
    )
    if foreground is None:
        return

    try:
        identity = json.loads(foreground.get("identity_json") or "{}")
    except (TypeError, ValueError):
        logger.debug("Foreground identity unavailable for PID %s", foreground_pid)
        return

    application_id = identity.get("application_id") or foreground.get("application_id")
    display_name = identity.get("display_name") or foreground.get("display_name")
    if not application_id or not display_name or identity.get("role") != "user_app":
        return

    conn = get_connection()
    conn.execute(
        """INSERT INTO application_activity (application_id, display_name, last_foreground_at)
           VALUES (?, ?, ?)
           ON CONFLICT(application_id) DO UPDATE SET
               display_name=excluded.display_name,
               last_foreground_at=excluded.last_foreground_at""",
        (str(application_id), str(display_name), timestamp),
    )
    conn.commit()


def _build_idle_suggestions(
    applications: list[dict[str, Any]],
    activity: dict[str, Any],
    now: float,
) -> list[dict[str, Any]]:
    suggestions = []
    for application in applications:
        last_foreground_at = activity.get(application["application_id"])
        if (
            application["role"] != "user_app"
            or last_foreground_at is None
            or now - last_foreground_at < IDLE_SUGGESTION_SECONDS
        ):
            continue
        suggestions.append({
            "application_id": application["application_id"],
            "display_name": application["display_name"],
            "last_foreground_at": last_foreground_at,
            "idle_seconds": int(now - last_foreground_at),
            "memory_bytes": application["memory_bytes"],
            "process_count": application["process_count"],
        })
    suggestions.sort(key=lambda item: item["idle_seconds"], reverse=True)
    return suggestions


def list_running_applications(
    sort_by: str = "cpu_percent",
    limit: int = 300,
    role_filter: Optional[str] = None,
    search: Optional[str] = None,
    include_system: bool = True,
) -> dict[str, Any]:
    """
    Group the most recent collector snapshot. This keeps application totals and
    per-process values consistent with the metrics, process, and diagnosis APIs.
    """
    conn = get_connection()
    latest = conn.execute(
        "SELECT MAX(timestamp) AS ts FROM process_snapshot WHERE is_demo=0"
    ).fetchone()
    timestamp = latest["ts"] if latest else None
    rows = []
    if timestamp is not None:
        rows = conn.execute(
            """SELECT pid, name, cpu_percent, memory_percent, memory_bytes,
                      status, create_time, ppid, display_name, application_id,
                      identity_json
               FROM process_snapshot
               WHERE timestamp=? AND is_demo=0 AND pid>0
               ORDER BY pid""",
            (timestamp,),
        ).fetchall()

    fg_pid, _ = get_foreground_process_info()
    profiles: list[dict] = []
    for row in rows:
        pid = row["pid"]
        process_name = row["name"] or "unknown"
        ident = None
        try:
            identity_data = json.loads(row["identity_json"] or "{}")
            fields = ProcessIdentity.__dataclass_fields__
            ident_values = {key: identity_data[key] for key in fields if key in identity_data}
            ident_values.update(pid=pid, process_name=process_name)
            if {"display_name", "display_source", "confidence", "application_id", "role"} <= ident_values.keys():
                ident = ProcessIdentity(**ident_values)
        except (TypeError, ValueError) as exc:
            logger.debug("Stored identity unavailable for PID %s: %s", pid, exc)

        if ident is None:
            label = row["display_name"] or f"{process_name} (unidentified application)"
            ident = ProcessIdentity(
                pid=pid,
                process_name=process_name,
                display_name=label,
                display_source="process_snapshot",
                confidence=0.35,
                application_id=row["application_id"] or f"proc:{process_name.lower()}:{pid}",
                role="background",
                parent_pid=row["ppid"],
                is_fallback_label=True,
            )

        profiles.append({
            "pid": pid,
            "process_name": process_name,
            "identity": ident.to_dict(),
            "cpu_percent": round((row["cpu_percent"] or 0.0) / _CPU_COUNT, 1),
            "memory_bytes": row["memory_bytes"] or 0,
            "memory_percent": row["memory_percent"] or 0.0,
            "status": row["status"],
            "create_time": row["create_time"],
        })

    groups = aggregate_identities_to_applications(profiles, foreground_pid=fg_pid)

    if role_filter:
        rf = role_filter.lower()
        if rf == "foreground":
            groups = [g for g in groups if g.is_foreground]
        elif rf == "background":
            groups = [g for g in groups if not g.is_foreground and g.role not in ("system", "service", "monitor_runtime")]
        elif rf == "system":
            groups = [g for g in groups if g.role in ("system", "service", "protected_system_process")]
        elif rf == "user_app":
            groups = [g for g in groups if g.role == "user_app"]
        elif rf == "monitor":
            groups = [g for g in groups if g.role == "monitor_runtime"]
        else:
            groups = [g for g in groups if g.role == rf]

    if not include_system:
        groups = [g for g in groups if g.role not in ("system", "service", "protected_system_process")]

    if search:
        q = search.lower().strip()
        groups = [
            g for g in groups
            if q in g.display_name.lower()
            or q in g.application_id.lower()
            or any(q in (p.get("process_name") or "").lower() or q in str(p.get("pid")) for p in g.processes)
        ]

    sort_keys = {
        "cpu_percent": lambda g: g.cpu_percent,
        "memory_bytes": lambda g: g.memory_bytes,
        "memory_mb": lambda g: g.memory_bytes,
        "process_count": lambda g: g.process_count,
    }
    key_fn = sort_keys.get(sort_by, sort_keys["cpu_percent"])
    groups.sort(key=key_fn, reverse=True)
    limited = groups[:limit]
    activity_rows = conn.execute(
        "SELECT application_id, display_name, last_foreground_at FROM application_activity"
    ).fetchall()
    activity = {
        row["application_id"]: row["last_foreground_at"]
        for row in activity_rows
    }
    now = time.time()
    application_data = []
    for group in limited:
        app = group.to_dict()
        app["last_foreground_at"] = activity.get(group.application_id)
        application_data.append(app)
    collector_age_seconds = None if timestamp is None else max(0.0, now - timestamp)
    idle_suggestions = (
        _build_idle_suggestions(application_data, activity, now)
        if collector_age_seconds is not None and collector_age_seconds <= 60
        else []
    )

    return {
        "timestamp": timestamp,
        "collector_age_seconds": collector_age_seconds,
        "cpu_core_count": _CPU_COUNT,
        "cpu_percent_note": "Per-process CPU values are normalized across logical cores (0–100% scale per process).",
        "total_applications": len(groups),
        "total_processes_enumerated": len(profiles),
        "idle_suggestion_threshold_seconds": IDLE_SUGGESTION_SECONDS,
        "idle_suggestions": idle_suggestions,
        "applications": application_data,
    }
