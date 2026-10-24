"""
api/settings.py – GET/POST /settings endpoint.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
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
    sampling_interval:    Optional[float] = Field(None, ge=1, le=30)
    rolling_window:       Optional[int]   = Field(None, ge=30, le=1000)
    zscore_threshold:     Optional[float] = Field(None, ge=1, le=5)
    persistence_n:        Optional[int]   = Field(None, ge=2, le=20)
    percentile_threshold: Optional[int]  = Field(None, ge=80, le=99)



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
