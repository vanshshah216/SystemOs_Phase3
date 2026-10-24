"""
database.py – SQLite initialization and connection management for SYSTEMOS.
All tables are created here on first run.
"""

import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "systemos.db"

# Thread-local storage for connections
_local = threading.local()


def get_connection() -> sqlite3.Connection:
    """Return a thread-local SQLite connection."""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30.0)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA busy_timeout=30000")
        _local.conn.execute("PRAGMA foreign_keys=ON")
    return _local.conn


def close_connection():
    """Close the thread-local connection if open."""
    if hasattr(_local, "conn") and _local.conn:
        _local.conn.close()
        _local.conn = None


def init_db():
    """Create all tables if they do not already exist."""
    conn = get_connection()
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS system_metric (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp        REAL    NOT NULL,
            cpu_percent      REAL,
            cpu_user         REAL,
            cpu_system       REAL,
            cpu_iowait       REAL,
            ram_used         INTEGER,
            ram_available    INTEGER,
            ram_percent      REAL,
            disk_read_bytes  INTEGER,
            disk_write_bytes INTEGER,
            network_sent_bytes INTEGER,
            network_recv_bytes INTEGER,
            is_demo          INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_sm_timestamp ON system_metric(timestamp);

        CREATE TABLE IF NOT EXISTS process_snapshot (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       REAL    NOT NULL,
            pid             INTEGER NOT NULL,
            name            TEXT,
            cpu_percent     REAL,
            memory_percent  REAL,
            memory_bytes    INTEGER,
            threads         INTEGER,
            io_read_bytes   INTEGER,
            io_write_bytes  INTEGER,
            is_demo         INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_ps_timestamp ON process_snapshot(timestamp);
        CREATE INDEX IF NOT EXISTS idx_ps_pid       ON process_snapshot(pid);
        CREATE INDEX IF NOT EXISTS idx_ps_pid_timestamp ON process_snapshot(pid, timestamp);
        CREATE INDEX IF NOT EXISTS idx_ps_ts_pid ON process_snapshot(timestamp, pid);

        CREATE TABLE IF NOT EXISTS application_lifecycle_event (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       REAL NOT NULL,
            application_id  TEXT NOT NULL,
            display_name    TEXT NOT NULL,
            process_name    TEXT NOT NULL,
            pid             INTEGER,
            evidence_json   TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ale_timestamp ON application_lifecycle_event(timestamp);

        CREATE TABLE IF NOT EXISTS browser_tab_event (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       REAL NOT NULL,
            browser         TEXT NOT NULL,
            title           TEXT NOT NULL,
            action          TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bte_timestamp ON browser_tab_event(timestamp);

        CREATE TABLE IF NOT EXISTS application_activity (
            application_id       TEXT PRIMARY KEY,
            display_name          TEXT NOT NULL,
            last_foreground_at    REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS diagnosis_event (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time      REAL    NOT NULL,
            end_time        REAL,
            severity        TEXT,
            probable_cause  TEXT,
            primary_process TEXT,
            evidence_json   TEXT,
            status          TEXT    DEFAULT 'active',
            created_at      REAL    NOT NULL,
            is_demo         INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS simulation_run (
            simulation_id     TEXT PRIMARY KEY,
            scenario          TEXT NOT NULL,
            start_time        REAL NOT NULL,
            end_time          REAL,
            samples_generated INTEGER DEFAULT 0,
            detection_stage   TEXT,
            diagnosis         TEXT,
            severity          TEXT,
            evidence          TEXT,
            status            TEXT
        );

        CREATE TABLE IF NOT EXISTS baseline_statistics (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_name     TEXT    NOT NULL,
            window_start    REAL    NOT NULL,
            window_end      REAL    NOT NULL,
            mean            REAL,
            standard_deviation REAL,
            percentile_50   REAL,
            percentile_90   REAL,
            percentile_95   REAL,
            percentile_99   REAL,
            trend_slope     REAL
        );

        CREATE INDEX IF NOT EXISTS idx_bs_metric ON baseline_statistics(metric_name);

        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO app_settings (key, value) VALUES
            ('sampling_interval',   '3'),
            ('rolling_window',      '300'),
            ('zscore_threshold',    '2.0'),
            ('persistence_n',       '4'),
            ('percentile_threshold','95');
    """)

    # Safe additive migrations for Phase 3 process columns
    for col_name, col_type in [
        ("ppid", "INTEGER"),
        ("status", "TEXT"),
        ("create_time", "REAL"),
        ("num_connections", "INTEGER"),
        ("application_id", "TEXT"),
        ("display_name", "TEXT"),
        ("identity_json", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE process_snapshot ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    for col_name, col_type in [
        ("category", "TEXT"),
        ("application_id", "TEXT"),
        ("primary_display_name", "TEXT"),
        ("primary_pid", "INTEGER"),
        ("primary_process_name", "TEXT"),
        ("incident_key", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE diagnosis_event ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    conn.commit()
    print(f"[DB] Initialized at {DB_PATH}")


def prune_old_snapshots(max_age_seconds: float = 7200):
    """
    Delete process_snapshots older than max_age_seconds (default 2 hours)
    to prevent unbounded database growth while preserving baseline analysis window.
    Also deletes old demo simulation records older than 30 minutes.
    """
    try:
        import time
        conn = get_connection()
        cutoff = time.time() - max_age_seconds
        conn.execute("DELETE FROM process_snapshot WHERE timestamp < ?", (cutoff,))
        demo_cutoff = time.time() - 1800
        conn.execute("DELETE FROM process_snapshot WHERE is_demo=1 AND timestamp < ?", (demo_cutoff,))
        conn.commit()
    except Exception as e:
        print(f"[DB] Prune error: {e}")


def get_setting(key: str, default=None):
    conn = get_connection()
    row = conn.execute("SELECT value FROM app_settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str):
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?,?)",
        (key, value)
    )
    conn.commit()
