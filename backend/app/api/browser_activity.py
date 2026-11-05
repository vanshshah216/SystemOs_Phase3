"""Local browser-tab activity ingestion for the optional SYSTEMOS extension."""

import re
import time
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.database import get_connection

router = APIRouter(prefix="/browser-activity", tags=["browser activity"])

class BrowserTabActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    browser: Literal["Google Chrome"]
    title: str = Field(min_length=1, max_length=500)
    action: Literal["observed", "opened", "activated", "title_changed"]
    tab_id: Optional[int] = Field(None, gt=0)
    window_id: int = 0
    active: bool = False


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
    if activity.tab_id is not None:
        if activity.action == "activated" or activity.active:
            conn.execute(
                """UPDATE browser_tab_activity
                   SET is_active=0, last_active_at=?
                   WHERE window_id=? AND is_active=1""",
                (timestamp, activity.window_id),
            )
        conn.execute(
            """INSERT INTO browser_tab_activity
                   (tab_id, window_id, browser, title, last_active_at, is_active)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(tab_id) DO UPDATE SET
                   window_id=excluded.window_id,
                   browser=excluded.browser,
                   title=excluded.title,
                   last_active_at=CASE
                       WHEN excluded.last_active_at > browser_tab_activity.last_active_at
                           AND ? THEN excluded.last_active_at
                       ELSE browser_tab_activity.last_active_at
                   END,
                   is_active=excluded.is_active""",
            (
                activity.tab_id,
                activity.window_id,
                activity.browser,
                title,
                timestamp,
                int(activity.active or activity.action == "activated"),
                int(activity.action in ("opened", "activated") or activity.active),
            ),
        )
    conn.commit()
    return {"id": cursor.lastrowid, "timestamp": timestamp, "recorded": True}


@router.delete("/{tab_id}")
def remove_browser_tab_activity(tab_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM browser_tab_activity WHERE tab_id=?", (tab_id,))
    conn.commit()
    return {"removed": True}
