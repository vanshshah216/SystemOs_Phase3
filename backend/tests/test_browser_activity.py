import sqlite3

import pytest
from pydantic import ValidationError

from app.api import browser_activity, events


def test_browser_activity_ingest_stores_title_and_action_only(monkeypatch):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE browser_tab_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            browser TEXT NOT NULL,
            title TEXT NOT NULL,
            action TEXT NOT NULL
        )"""
    )
    monkeypatch.setattr(browser_activity, "get_connection", lambda: connection)
    payload = browser_activity.BrowserTabActivity(
        browser="Microsoft Edge",
        title="  Docs\t - Microsoft Edge  ",
        action="activated",
    )

    response = browser_activity.record_browser_activity(payload)
    row = connection.execute("SELECT * FROM browser_tab_event").fetchone()

    assert response["recorded"] is True
    assert row["title"] == "Docs  - Microsoft Edge"
    assert row["action"] == "activated"
    connection.close()


def test_browser_activity_rejects_url_fields():
    with pytest.raises(ValidationError):
        browser_activity.BrowserTabActivity.model_validate({
            "browser": "Google Chrome",
            "title": "Private page",
            "action": "opened",
            "url": "https://example.invalid/private",
        })


def test_browser_tab_event_is_searchable_activity_and_retrievable(monkeypatch):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE diagnosis_event (
            id INTEGER PRIMARY KEY,
            status TEXT,
            is_demo INTEGER,
            created_at REAL
        );
        CREATE TABLE application_lifecycle_event (
            id INTEGER PRIMARY KEY,
            timestamp REAL NOT NULL,
            application_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            process_name TEXT NOT NULL,
            pid INTEGER,
            evidence_json TEXT NOT NULL
        );
        CREATE TABLE browser_tab_event (
            id INTEGER PRIMARY KEY,
            timestamp REAL NOT NULL,
            browser TEXT NOT NULL,
            title TEXT NOT NULL,
            action TEXT NOT NULL
        );
        INSERT INTO browser_tab_event(id, timestamp, browser, title, action)
        VALUES (7, 123, 'Google Chrome', 'SystemOS docs', 'opened');
        """
    )
    monkeypatch.setattr(events, "get_connection", lambda: connection)

    listing = events.list_events(status=None, include_applications=True, live_only=True)
    event = listing["events"][0]
    detail = events.get_event(event["id"])

    assert event["event_type"] == "browser_tab_activity"
    assert event["category"] == "browser_tab"
    assert event["probable_cause"] == "Google Chrome tab was opened: SystemOS docs"
    assert "no URL or page content" in " ".join(event["evidence"]["evidence_items"])
    assert detail["id"] == event["id"]
    assert detail["evidence"]["raw_stats"]["activity"] == "opened"
    connection.close()
