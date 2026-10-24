"""Local browser-tab activity ingestion for the optional SYSTEMOS extension."""

import re
import time
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.database import get_connection

router = APIRouter(prefix="/browser-activity", tags=["browser activity"])

class BrowserTabActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    browser: Literal["Google Chrome", "Microsoft Edge"]
    title: str = Field(min_length=1, max_length=500)
    action: Literal["observed", "opened", "activated", "title_changed"]


@router.post("")
def record_browser_activity(activity: BrowserTabActivity):
    """Store the tab title and activity type; URLs and page contents are not accepted."""
    title = re.sub(r"[\x00-\x1f\x7f]", " ", activity.title).strip()
    if not title:
        raise HTTPException(status_code=422, detail="A non-empty browser tab title is required")

    timestamp = time.time()
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO browser_tab_event(timestamp, browser, title, action) VALUES (?, ?, ?, ?)",
        (timestamp, activity.browser, title, activity.action),
    )
    conn.commit()
    return {"id": cursor.lastrowid, "timestamp": timestamp, "recorded": True}
