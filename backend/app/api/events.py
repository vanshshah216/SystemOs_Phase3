"""
api/events.py – /events/* endpoints.
Includes evidence JSON in the list response so the overview DiagnosisCard
can show evidence without a second fetch.
"""

import json
from fastapi import APIRouter, HTTPException, Query
from app.database import get_connection

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def list_events(limit: int = 100, status: str = Query(None)):
    """Return all diagnosis events, newest first, with evidence included."""
    conn = get_connection()
    query = "SELECT * FROM diagnosis_event"
    params: list = []
    if status:
        query += " WHERE status=?"
        params.append(status)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    # Include evidence in list response so UI can display without extra fetch
    return {"events": [_format_event(r, full=True) for r in rows]}


@router.get("/{event_id}")
def get_event(event_id: int):
    """Return full event detail including evidence."""
    conn = get_connection()
    row  = conn.execute("SELECT * FROM diagnosis_event WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return _format_event(row, full=True)


def _format_event(row, full: bool = False) -> dict:
    ev = {
        "id":              row["id"],
        "start_time":      row["start_time"],
        "end_time":        row["end_time"],
        "severity":        row["severity"],
        "probable_cause":  row["probable_cause"],
        "primary_process": row["primary_process"],
        "status":          row["status"],
        "created_at":      row["created_at"],
        "is_demo":         bool(row["is_demo"]),
    }
    if full:
        try:
            ev["evidence"] = json.loads(row["evidence_json"] or "{}")
        except Exception:
            ev["evidence"] = {}
    return ev
