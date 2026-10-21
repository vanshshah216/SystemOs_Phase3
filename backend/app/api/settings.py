"""
api/settings.py – GET/POST /settings endpoint.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from app.database import get_connection, get_setting, set_setting

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_KEYS = [
    "sampling_interval",
    "rolling_window",
    "zscore_threshold",
    "persistence_n",
    "percentile_threshold",
]


from typing import Optional

class SettingsUpdate(BaseModel):
    sampling_interval:    Optional[float] = None
    rolling_window:       Optional[int]   = None
    zscore_threshold:     Optional[float] = None
    persistence_n:        Optional[int]   = None
    percentile_threshold: Optional[int]   = None



@router.get("")
def get_settings():
    return {k: get_setting(k) for k in SETTINGS_KEYS}


@router.post("")
def update_settings(body: SettingsUpdate):
    updates = body.model_dump(exclude_none=True)
    for key, val in updates.items():
        if key in SETTINGS_KEYS:
            set_setting(key, str(val))
    return {"updated": updates, "current": {k: get_setting(k) for k in SETTINGS_KEYS}}
