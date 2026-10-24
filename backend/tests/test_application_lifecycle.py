import json
import sqlite3

from app.api import events as events_api
from app.services import application_lifecycle


def test_application_start_is_recorded_once_after_baseline(monkeypatch):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE process_snapshot (
            timestamp REAL NOT NULL,
            is_demo INTEGER NOT NULL DEFAULT 0,
            application_id TEXT
        );
        CREATE TABLE application_lifecycle_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            application_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            process_name TEXT NOT NULL,
            pid INTEGER,
            evidence_json TEXT NOT NULL
        );
        INSERT INTO process_snapshot(timestamp, is_demo, application_id)
        VALUES (10, 0, 'existing-app');
        """
    )
    monkeypatch.setattr(application_lifecycle, "get_connection", lambda: connection)
    application_lifecycle.reset_application_lifecycle_baseline()

    baseline = [{
        "pid": 10,
        "name": "existing.exe",
        "application_id": "existing-app",
        "identity_json": json.dumps({
            "application_id": "existing-app",
            "display_name": "Existing App",
            "role": "user_app",
        }),
    }]
    assert application_lifecycle.record_application_starts(baseline, 11) == 0

    connection.execute(
        "INSERT INTO process_snapshot(timestamp, is_demo, application_id) VALUES (11, 0, 'existing-app')"
    )
    current = baseline + [{
        "pid": 20,
        "name": "mspaint.exe",
        "application_id": "microsoft-paint",
        "identity_json": json.dumps({
            "application_id": "microsoft-paint",
            "display_name": "Microsoft Paint",
            "role": "user_app",
        }),
    }]

    assert application_lifecycle.record_application_starts(current, 12) == 1
    connection.execute(
        "INSERT INTO process_snapshot(timestamp, is_demo, application_id) VALUES (12, 0, 'microsoft-paint')"
    )
    connection.execute(
        "INSERT INTO process_snapshot(timestamp, is_demo, application_id) VALUES (12, 0, 'existing-app')"
    )
    assert application_lifecycle.record_application_starts(current, 13) == 0

    event = connection.execute(
        "SELECT * FROM application_lifecycle_event"
    ).fetchone()
    assert event["display_name"] == "Microsoft Paint"
    assert event["process_name"] == "mspaint.exe"
    assert event["pid"] == 20

    connection.close()
    application_lifecycle.reset_application_lifecycle_baseline()


def test_events_api_includes_application_start_as_separate_activity(monkeypatch):
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
        INSERT INTO application_lifecycle_event
            (timestamp, application_id, display_name, process_name, pid, evidence_json)
        VALUES (123, 'microsoft-paint', 'Microsoft Paint', 'mspaint.exe', 42, '{}');
        """
    )
    monkeypatch.setattr(events_api, "get_connection", lambda: connection)

    result = events_api.list_events(status=None, include_applications=True, live_only=True)
    activity = result["events"][0]

    assert activity["event_type"] == "application_started"
    assert activity["category"] == "application"
    assert activity["status"] == "recorded"
    assert activity["primary_display_name"] == "Microsoft Paint"
    assert activity["primary_process_name"] == "mspaint.exe"
    assert activity["primary_pid"] == 42
    assert events_api.get_event(activity["id"])["event_type"] == "application_started"

    connection.close()


def test_historical_store_diagnosis_uses_friendly_name_but_keeps_executable():
    row = {
        "id": 7,
        "start_time": 100,
        "end_time": None,
        "severity": "MEDIUM",
        "probable_cause": "Unusual resource use in WinStore.App.exe",
        "primary_process": "WinStore.App.exe",
        "status": "active",
        "created_at": 100,
        "is_demo": 0,
        "category": "memory",
        "application_id": "proc:winstore.app.exe:42",
        "primary_display_name": "WinStore.App.exe (unidentified application)",
        "primary_pid": 42,
        "primary_process_name": "WinStore.App.exe",
        "incident_key": None,
        "evidence_json": "{}",
    }

    event = events_api._format_event(row, full=True)

    assert event["primary_display_name"] == "Microsoft Store"
    assert event["primary_process"] == "Microsoft Store"
    assert event["primary_process_name"] == "WinStore.App.exe"
    assert event["probable_cause"] == "Unusual resource use in Microsoft Store"
