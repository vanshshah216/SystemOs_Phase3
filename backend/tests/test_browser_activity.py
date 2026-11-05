import sqlite3

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import browser_activity, events


def test_browser_activity_ingest_stores_title_and_action_only(monkeypatch):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """CREATE TABLE browser_tab_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            browser TEXT NOT NULL,
            title TEXT NOT NULL,
            action TEXT NOT NULL
        );
        CREATE TABLE browser_tab_activity (
            tab_id INTEGER PRIMARY KEY,
            window_id INTEGER NOT NULL,
            browser TEXT NOT NULL,
            title TEXT NOT NULL,
            last_active_at REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO browser_tab_activity
            (tab_id, window_id, browser, title, last_active_at, is_active)
        VALUES (16, 4, 'Google Chrome', 'Previous active tab', 100, 1);"""
    )
    monkeypatch.setattr(browser_activity, "get_connection", lambda: connection)
    payload = browser_activity.BrowserTabActivity(
        browser="Google Chrome",
        title="  Docs\t - Google Chrome  ",
        action="activated",
        tab_id=17,
        window_id=4,
        active=True,
    )

    response = browser_activity.record_browser_activity(payload)
    row = connection.execute("SELECT * FROM browser_tab_event").fetchone()
    tab = connection.execute(
        "SELECT * FROM browser_tab_activity WHERE tab_id=17"
    ).fetchone()
    previous_tab = connection.execute(
        "SELECT * FROM browser_tab_activity WHERE tab_id=16"
    ).fetchone()

    assert response["recorded"] is True
    assert row["browser"] == "Google Chrome"
    assert row["title"] == "Docs  - Google Chrome"
    assert row["action"] == "activated"
    assert tab["tab_id"] == 17
    assert tab["window_id"] == 4
    assert tab["is_active"] == 1
    assert previous_tab["is_active"] == 0
    assert previous_tab["last_active_at"] == response["timestamp"]

    browser_activity.remove_browser_tab_activity(17)
    assert connection.execute(
        "SELECT COUNT(*) FROM browser_tab_activity WHERE tab_id=17"
    ).fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM browser_tab_activity").fetchone()[0] == 1
    connection.close()


def test_browser_activity_rejects_url_fields():
    with pytest.raises(ValidationError):
        browser_activity.BrowserTabActivity.model_validate({
            "browser": "Google Chrome",
            "title": "Private page",
            "action": "opened",
            "url": "https://example.invalid/private",
        })


def test_browser_activity_rejects_edge():
    with pytest.raises(ValidationError):
        browser_activity.BrowserTabActivity.model_validate({
            "browser": "Microsoft Edge",
            "title": "Private page",
            "action": "opened",
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
        INSERT INTO browser_tab_event(id, timestamp, browser, title, action)
        VALUES (8, 124, 'Microsoft Edge', 'Edge tab', 'opened');
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
    edge_listing = [
        item for item in listing["events"]
        if item["probable_cause"].endswith("Edge tab")
    ]
    assert edge_listing == []
    with pytest.raises(HTTPException) as exc_info:
        events.get_event(-1_000_000_008)
    assert exc_info.value.status_code == 404
    connection.close()
