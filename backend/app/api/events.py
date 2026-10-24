"""
api/events.py – /events/* endpoints.
Includes evidence JSON in the list response so the overview DiagnosisCard
can show evidence without a second fetch.
"""

import json
import re
from fastapi import APIRouter, HTTPException, Query
from app.collector.app_identity import recognizable_application_name
from app.database import get_connection

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def list_events(
    limit: int = 100,
    status: str = Query(None),
    live_only: bool = Query(False, description="Exclude demo/simulation events"),
    include_applications: bool = Query(False, description="Include application start activity"),
):
    """Return diagnostic events, optionally combined with application activity."""
    conn = get_connection()
    query = "SELECT * FROM diagnosis_event"
    params: list = []
    clauses = []
    if status:
        clauses.append("status=?")
        params.append(status)
    if live_only:
        clauses.append("is_demo=0")
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    events = [_format_event(r, full=True) for r in rows]

    if include_applications and status in (None, "recorded"):
        activity_rows = conn.execute(
            """SELECT id, timestamp, application_id, display_name, process_name, pid, evidence_json
               FROM application_lifecycle_event
               ORDER BY timestamp DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        events.extend(_format_application_event(row) for row in activity_rows)
        browser_rows = conn.execute(
            """SELECT id, timestamp, browser, title, action
               FROM browser_tab_event
               ORDER BY timestamp DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        events.extend(_format_browser_tab_event(row) for row in browser_rows)

    events.sort(key=lambda event: event["created_at"], reverse=True)
    return {"events": events[:limit]}


@router.get("/{event_id}")
def get_event(event_id: int):
    """Return full event detail including evidence."""
    conn = get_connection()
    if event_id <= -1_000_000_000:
        row = conn.execute(
            "SELECT id, timestamp, browser, title, action FROM browser_tab_event WHERE id=?",
            (-event_id - 1_000_000_000,),
        ).fetchone()
        if row:
            return _format_browser_tab_event(row)
    if event_id < 0:
        row = conn.execute(
            "SELECT id, timestamp, application_id, display_name, process_name, pid, evidence_json "
            "FROM application_lifecycle_event WHERE id=?",
            (-event_id,),
        ).fetchone()
        if row:
            return _format_application_event(row)
    row  = conn.execute("SELECT * FROM diagnosis_event WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return _format_event(row, full=True)


def _format_event(row, full: bool = False) -> dict:
    keys = row.keys() if hasattr(row, "keys") else []
    process_name = row["primary_process_name"] if "primary_process_name" in keys else row["primary_process"]
    application_id = row["application_id"] if "application_id" in keys else None
    display_name = recognizable_application_name(process_name, application_id) or (
        row["primary_display_name"] if "primary_display_name" in keys else row["primary_process"]
    )
    probable_cause = row["probable_cause"]
    severity = row["severity"]
    category = row["category"] if "category" in keys else None
    legacy_memory_growth = bool(re.search(
        r"sustained\s+unusual\s+memory\s+growth|unusual\s+memory\s+growth",
        probable_cause or "",
        re.IGNORECASE,
    ))
    if display_name and process_name and display_name != process_name:
        probable_cause = re.sub(
            re.escape(process_name),
            display_name,
            probable_cause or "",
            flags=re.IGNORECASE,
        )
    if legacy_memory_growth:
        probable_cause = f"Gradual memory increase observed for {display_name or process_name or 'a process'}"
        severity = "LOW"
        category = "memory"
    ev = {
        "id":              row["id"],
        "start_time":      row["start_time"],
        "end_time":        row["end_time"],
        "severity":        severity,
        "probable_cause":  probable_cause,
        "primary_process": display_name or row["primary_process"],
        "status":          row["status"],
        "created_at":      row["created_at"],
        "is_demo":         bool(row["is_demo"]),
        "category":        category,
        "application_id":  application_id,
        "primary_display_name": display_name or row["primary_process"],
        "primary_pid":     row["primary_pid"] if "primary_pid" in keys else None,
        "primary_process_name": process_name,
        "incident_key":    row["incident_key"] if "incident_key" in keys else None,
    }
    if full:
        try:
            ev["evidence"] = json.loads(row["evidence_json"] or "{}")
        except Exception:
            ev["evidence"] = {}
        if legacy_memory_growth:
            if not isinstance(ev["evidence"], dict):
                ev["evidence"] = {}
            ev["evidence"]["evidence_items"] = [
                "An earlier monitor version recorded an increase in process memory.",
                "This historical observation is not confirmation of a memory leak or performance problem.",
            ]
            ev["evidence"]["evidence_strength"] = None
            raw_stats = ev["evidence"].get("raw_stats")
            if not isinstance(raw_stats, dict):
                raw_stats = {}
            raw_stats["rule_id"] = "E"
            ev["evidence"]["raw_stats"] = raw_stats
    return ev


def _format_application_event(row) -> dict:
    timestamp = row["timestamp"]
    display_name = recognizable_application_name(
        row["process_name"],
        row["application_id"],
    ) or row["display_name"]
    try:
        evidence = json.loads(row["evidence_json"] or "{}")
    except (TypeError, ValueError):
        evidence = {}
    return {
        "id": -row["id"],
        "event_type": "application_started",
        "start_time": timestamp,
        "end_time": timestamp,
        "severity": "LOW",
        "probable_cause": f"Application started: {display_name}",
        "primary_process": display_name,
        "status": "recorded",
        "created_at": timestamp,
        "is_demo": False,
        "category": "application",
        "application_id": row["application_id"],
        "primary_display_name": display_name,
        "primary_pid": row["pid"],
        "primary_process_name": row["process_name"],
        "incident_key": None,
        "evidence": {
            "evidence_items": [
                f"Detected process: {row['process_name']}",
                f"PID: {row['pid']}",
            ],
            "evidence_strength": None,
            "raw_stats": evidence,
        },
    }


def _format_browser_tab_event(row) -> dict:
    timestamp = row["timestamp"]
    action_label = {
        "observed": "was already open",
        "opened": "was opened",
        "activated": "was selected",
        "title_changed": "changed",
    }.get(row["action"], "was observed")
    title = row["title"]
    browser = row["browser"]
    return {
        "id": -1_000_000_000 - row["id"],
        "event_type": "browser_tab_activity",
        "start_time": timestamp,
        "end_time": timestamp,
        "severity": "LOW",
        "probable_cause": f"{browser} tab {action_label}: {title}",
        "primary_process": browser,
        "status": "recorded",
        "created_at": timestamp,
        "is_demo": False,
        "category": "browser_tab",
        "application_id": browser.lower().replace(" ", "-"),
        "primary_display_name": browser,
        "primary_process_name": None,
        "primary_pid": None,
        "incident_key": None,
        "evidence": {
            "evidence_items": [
                f"Tab title: {title}",
                f"Browser: {browser}",
                "Only the title and activity type were collected; no URL or page content was sent.",
                "CPU and memory measurements are available only for the browser as a whole, not for an individual tab.",
            ],
            "evidence_strength": None,
            "raw_stats": {
                "activity": row["action"],
                "tab_title": title,
                "browser": browser,
            },
        },
    }
