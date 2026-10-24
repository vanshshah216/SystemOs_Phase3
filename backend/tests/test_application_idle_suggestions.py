import sqlite3

from app.services import applications


def test_foreground_activity_is_persisted_for_user_app(monkeypatch):
    connection = sqlite3.connect(":memory:")
    connection.execute(
        """CREATE TABLE application_activity (
               application_id TEXT PRIMARY KEY,
               display_name TEXT NOT NULL,
               last_foreground_at REAL NOT NULL
           )"""
    )
    monkeypatch.setattr(applications, "get_connection", lambda: connection)
    monkeypatch.setattr(applications, "get_foreground_process_info", lambda: (42, None))

    applications.record_foreground_application(
        [{
            "pid": 42,
            "application_id": "test-app",
            "display_name": "Test App",
            "identity_json": '{"application_id":"test-app","display_name":"Test App","role":"user_app"}',
        }],
        1000,
    )

    activity = connection.execute(
        "SELECT application_id, display_name, last_foreground_at FROM application_activity"
    ).fetchone()
    assert activity == ("test-app", "Test App", 1000)
    connection.close()


def test_idle_suggestions_require_one_hour_and_exclude_non_apps():
    suggestions = applications._build_idle_suggestions(
        [
            {
                "application_id": "idle-app",
                "display_name": "Idle App",
                "role": "user_app",
                "memory_bytes": 2000,
                "process_count": 2,
            },
            {
                "application_id": "recent-app",
                "display_name": "Recent App",
                "role": "user_app",
                "memory_bytes": 1000,
                "process_count": 1,
            },
            {
                "application_id": "system",
                "display_name": "System Process",
                "role": "system",
                "memory_bytes": 5000,
                "process_count": 1,
            },
        ],
        {
            "idle-app": 1000,
            "recent-app": 4000,
            "system": 0,
        },
        now=1000 + applications.IDLE_SUGGESTION_SECONDS,
    )

    assert len(suggestions) == 1
    assert suggestions[0]["application_id"] == "idle-app"
    assert suggestions[0]["idle_seconds"] == applications.IDLE_SUGGESTION_SECONDS
