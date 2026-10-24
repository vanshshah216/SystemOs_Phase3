"""
api/applications.py – Grouped application listings with aggregated resource metrics.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.services.applications import list_running_applications

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("")
def get_applications(
    sort_by: str = Query("cpu_percent", description="cpu_percent | memory_bytes | memory_mb | process_count"),
    limit: int = Query(300, ge=1, le=500),
    role: Optional[str] = Query(None, description="foreground | background | system | user_app | monitor"),
    search: Optional[str] = Query(None),
    include_system: bool = Query(True),
):
    return list_running_applications(
        sort_by=sort_by,
        limit=limit,
        role_filter=role,
        search=search,
        include_system=include_system,
    )
