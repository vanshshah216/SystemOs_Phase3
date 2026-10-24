"""Persist application starts detected between successful live process snapshots."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from app.database import get_connection

logger = logging.getLogger("systemos.application_lifecycle")

_baseline_initialized = False


def reset_application_lifecycle_baseline() -> None:
    global _baseline_initialized
    _baseline_initialized = False


def _candidate_applications(snapshots: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    system_root = os.path.normcase(os.path.abspath(os.environ.get("SystemRoot", r"C:\Windows")))
    candidates: dict[str, dict[str, Any]] = {}

    for snapshot in snapshots:
        try:
            identity = json.loads(snapshot.get("identity_json") or "{}")
        except (TypeError, ValueError):
            continue

        application_id = identity.get("application_id") or snapshot.get("application_id")
        process_name = snapshot.get("name") or identity.get("process_name")
        if not application_id or not process_name:
            continue

        role = identity.get("role")
        if role in {"system", "service", "helper", "monitor_runtime", "protected_system_process"}:
            continue

        if role != "user_app":
            executable = identity.get("exe_path")
            if not executable:
                continue
            normalized_exe = os.path.normcase(os.path.abspath(executable))
            if normalized_exe == system_root or normalized_exe.startswith(system_root.rstrip(os.sep) + os.sep):
                continue

        candidate = {
            "application_id": str(application_id),
            "display_name": identity.get("display_name") or f"{process_name} (unidentified application)",
            "process_name": str(process_name),
            "pid": snapshot.get("pid"),
        }
        existing = candidates.get(str(application_id))
        if existing is None or role == "user_app":
            candidates[str(application_id)] = candidate

    return candidates


def record_application_starts(snapshots: list[dict[str, Any]], timestamp: float) -> int:
    """Record newly observed user applications; the first sample establishes a baseline."""
    global _baseline_initialized
    current = _candidate_applications(snapshots)
    if not _baseline_initialized:
        _baseline_initialized = True
        logger.info("Application activity baseline established (%d applications)", len(current))
        return 0

    conn = get_connection()
    previous = conn.execute(
        "SELECT MAX(timestamp) AS timestamp FROM process_snapshot WHERE is_demo=0 AND timestamp < ?",
        (timestamp,),
    ).fetchone()
    previous_timestamp = previous["timestamp"] if previous else None
    if previous_timestamp is None:
        return 0

    previous_ids = {
        row["application_id"]
        for row in conn.execute(
            "SELECT DISTINCT application_id FROM process_snapshot "
            "WHERE timestamp=? AND is_demo=0 AND application_id IS NOT NULL",
            (previous_timestamp,),
        ).fetchall()
    }
    started = [app for key, app in current.items() if key not in previous_ids]

    for app in started:
        evidence = {
            "action": "started",
            "application_id": app["application_id"],
            "process_name": app["process_name"],
            "pid": app["pid"],
            "detection": "Application first appeared in a completed live process snapshot.",
        }
        conn.execute(
            """INSERT INTO application_lifecycle_event
               (timestamp, application_id, display_name, process_name, pid, evidence_json)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                timestamp,
                app["application_id"],
                app["display_name"],
                app["process_name"],
                app["pid"],
                json.dumps(evidence),
            ),
        )

    if started:
        conn.commit()
        logger.info("Recorded %d newly detected application start(s)", len(started))
    return len(started)
