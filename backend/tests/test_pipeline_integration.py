"""
tests/test_pipeline_integration.py – End-to-end pipeline integration & API verification.

Verifies the complete data pipeline:
psutil/Mock Collector -> SQLite -> Statistics -> Anomaly Detection ->
Persistence Checking -> Process Attribution -> Diagnosis Rules A-E ->
FastAPI REST API -> Frontend Payloads.

All tests execute purely in-memory/mocked without placing real resource load on the host.
"""

import time
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_connection, set_setting, get_setting, init_db
from app.collector.telemetry import store_system_metric, store_process_snapshots
from app.services.pipeline import run_analysis_pipeline, _history, _proc_mem_history
from app.diagnosis.process_analyzer import analyze_processes, classify_activity, generate_recommendations


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


# ── 1. Pipeline Verification with Mocked Telemetry ────────────────────────────

def test_full_pipeline_cpu_stress_scenario(client):
    """
    Feeds synthetic CPU spikes over consecutive cycles to verify:
    Collector -> SQLite -> Anomaly Detection -> Persistence -> Attribution -> Rule A firing.
    """
    now = time.time()
    proc_mock = [
        {"pid": 7771, "name": "HeavyWorker.exe", "cpu_percent": 82.0, "memory_percent": 12.0, "memory_bytes": 1024**3, "threads": 16, "io_read_bytes": 1000, "io_write_bytes": 1000, "is_demo": 1},
        {"pid": 7772, "name": "Helper.exe", "cpu_percent": 5.0, "memory_percent": 2.0, "memory_bytes": 200*1024**2, "threads": 4, "io_read_bytes": 100, "io_write_bytes": 100, "is_demo": 1},
    ]

    # Feed 25 baseline samples (CPU ~20%)
    for i in range(25):
        t = now - 200 + (i * 3)
        sys_metric = {
            "timestamp": t, "cpu_percent": 20.0, "cpu_user": 14.0, "cpu_system": 6.0,
            "cpu_iowait": None, "ram_used": 4*1024**3, "ram_available": 12*1024**3, "ram_percent": 25.0,
            "disk_read_bytes": 10000, "disk_write_bytes": 10000, "network_sent_bytes": 5000, "network_recv_bytes": 5000,
            "is_demo": 1
        }
        store_system_metric(sys_metric)
        store_process_snapshots([
            {"pid": 7771, "name": "HeavyWorker.exe", "cpu_percent": 10.0, "memory_percent": 5.0, "memory_bytes": 500*1024**2, "threads": 4, "io_read_bytes": 100, "io_write_bytes": 100, "is_demo": 1, "timestamp": t}
        ])
        run_analysis_pipeline(sys_metric, proc_mock, is_demo=True)

    # Feed 6 sustained anomaly samples (CPU ~92%)
    for i in range(6):
        t = now - 50 + (i * 3)
        sys_metric = {
            "timestamp": t, "cpu_percent": 92.0, "cpu_user": 75.0, "cpu_system": 17.0,
            "cpu_iowait": None, "ram_used": 5*1024**3, "ram_available": 11*1024**3, "ram_percent": 30.0,
            "disk_read_bytes": 20000, "disk_write_bytes": 20000, "network_sent_bytes": 5000, "network_recv_bytes": 5000,
            "is_demo": 1
        }
        store_system_metric(sys_metric)
        store_process_snapshots([
            {**p, "timestamp": t} for p in proc_mock
        ])
        run_analysis_pipeline(sys_metric, proc_mock, is_demo=True)

    # Verify event was created in database
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM diagnosis_event WHERE probable_cause LIKE '%CPU contention%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert row is not None
    assert row["severity"] in ("HIGH", "MEDIUM")
    assert row["primary_process"] == "HeavyWorker.exe"


def test_full_pipeline_memory_pressure_scenario(client):
    """
    Feeds memory pressure to trigger Rule B.
    """
    now = time.time()
    proc_mock = [
        {"pid": 8881, "name": "MemoryEater.exe", "cpu_percent": 4.0, "memory_percent": 65.0, "memory_bytes": 10 * 1024**3, "threads": 8, "io_read_bytes": 50000, "io_write_bytes": 20000, "is_demo": 1},
    ]

    # Baseline samples
    for i in range(25):
        t = now - 150 + (i * 3)
        sys_metric = {
            "timestamp": t, "cpu_percent": 25.0, "cpu_user": 18.0, "cpu_system": 7.0,
            "cpu_iowait": None, "ram_used": 4*1024**3, "ram_available": 12*1024**3, "ram_percent": 25.0,
            "disk_read_bytes": 10000, "disk_write_bytes": 10000, "network_sent_bytes": 5000, "network_recv_bytes": 5000,
            "is_demo": 1
        }
        run_analysis_pipeline(sys_metric, proc_mock, is_demo=True)

    # Sustained memory surge
    for i in range(6):
        t = now - 50 + (i * 3)
        sys_metric = {
            "timestamp": t, "cpu_percent": 25.0, "cpu_user": 18.0, "cpu_system": 7.0,
            "cpu_iowait": None, "ram_used": 14*1024**3, "ram_available": 2*1024**3, "ram_percent": 94.0,
            "disk_read_bytes": 35 * 1024**2, "disk_write_bytes": 5 * 1024**2, "network_sent_bytes": 5000, "network_recv_bytes": 5000,
            "is_demo": 1
        }
        store_system_metric(sys_metric)
        store_process_snapshots([{**p, "timestamp": t} for p in proc_mock])
        run_analysis_pipeline(sys_metric, proc_mock, is_demo=True)

    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM diagnosis_event WHERE probable_cause LIKE '%Memory pressure%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert row is not None


# ── 2. Health Check Component Verification ─────────────────────────────────────

def test_pipeline_health_endpoint(client):
    """
    Verifies that /health returns all 6 pipeline components with their status.
    """
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "pipeline_health" in data
    components = data["pipeline_health"]["components"]
    expected = [
        "telemetry_collector",
        "database_storage",
        "statistical_engine",
        "anomaly_detector",
        "process_analyzer",
        "diagnosis_rules",
    ]
    for comp in expected:
        assert comp in components
        assert "status" in components[comp]
        assert "name" in components[comp]
        assert "details" in components[comp]


# ── 3. Process Analyzer & Classification Verification ──────────────────────────

def test_process_analyzer_endpoints(client):
    """
    Verifies /processes/analyzer, /processes/recommendations, and /processes/categories.
    """
    # 1. Categories
    cat_resp = client.get("/processes/categories")
    assert cat_resp.status_code == 200
    cat_data = cat_resp.json()
    breakdown = cat_data.get("categories_breakdown", {})
    expected_categories = [
        "Active application",
        "High resource consumer",
        "Background process",
        "Protected/system process",
        "Review candidate",
        "Insufficient information",
    ]
    for ec in expected_categories:
        assert any(v.get("label") == ec for v in breakdown.values())

    # 2. Process Analyzer list
    pa_resp = client.get("/processes/analyzer?limit=10")
    assert pa_resp.status_code == 200
    pa_data = pa_resp.json()
    assert "summary" in pa_data
    assert "processes" in pa_data
    assert "total_analyzed" in pa_data["summary"]
    assert "active_application_count" in pa_data["summary"]

    # 3. Recommendations
    rec_resp = client.get("/processes/recommendations?limit=10")
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert "recommendations" in rec_data
    assert "potential_reclaimable_memory_mb" in rec_data
    assert "count" in rec_data


# ── 4. Error Handling Verification ─────────────────────────────────────────────

def test_error_handling_nonexistent_process(client):
    """
    Nonexistent PID should cleanly return 404 with explainable detail.
    """
    resp = client.get("/processes/99999999/analysis")
    assert resp.status_code == 404
    detail = resp.json().get("detail", "").lower()
    assert "not running" in detail or "inaccessible" in detail


def test_error_handling_invalid_setting(client):
    """
    Posting invalid settings format or unknown key should not crash backend.
    """
    resp = client.post("/settings", json={"invalid_key": "abc"})
    assert resp.status_code == 200


def test_error_handling_events_detail_not_found(client):
    resp = client.get("/events/99999999")
    assert resp.status_code == 404


# ── 5. Demo Simulator Lifecycle Verification ───────────────────────────────────

def test_demo_simulator_lifecycle(client):
    """
    Verifies listing scenarios, starting, checking status, and stopping cleanly.
    """
    # 1. Scenarios
    sc_resp = client.get("/demo/scenarios")
    assert sc_resp.status_code == 200
    scenarios = sc_resp.json().get("scenarios", [])
    assert any(s["id"] == "cpu_stress" for s in scenarios)
    assert any(s["id"] == "memory_pressure" for s in scenarios)
    assert any(s["id"] == "process_memory_growth" for s in scenarios)

    # 2. Start simulation
    start_resp = client.post("/demo/start", json={"scenario": "cpu_stress"})
    assert start_resp.status_code == 200
    assert start_resp.json().get("status") == "started"

    # 3. Status check
    stat_resp = client.get("/demo/status")
    assert stat_resp.status_code == 200
    stat_data = stat_resp.json()
    assert stat_data.get("active_scenario") == "cpu_stress"

    # 4. Stop simulation
    stop_resp = client.post("/demo/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json().get("status") == "stopped"


# ── 6. Windows Compatibility Verification ─────────────────────────────────────

def test_windows_compatibility_cpu_iowait():
    """
    On Windows, cpu_times().iowait does not exist; code must cleanly set None without throwing.
    """
    from app.collector.telemetry import collect_system_metrics
    m = collect_system_metrics()
    assert "cpu_percent" in m
    assert "ram_percent" in m
    assert "cpu_iowait" in m
    # On Windows, cpu_iowait is None
    assert m["cpu_iowait"] is None or isinstance(m["cpu_iowait"], (int, float))


def test_windows_foreground_process_detection():
    """
    Verifies Win32 foreground process detection helper executes safely.
    """
    from app.diagnosis.process_analyzer import get_foreground_process_info
    fg_pid, fg_title = get_foreground_process_info()
    # On Windows, fg_pid is an int or None
    assert fg_pid is None or isinstance(fg_pid, int)
    assert fg_title is None or isinstance(fg_title, str)


# ── 7. Database Persistence & KV Settings ──────────────────────────────────────

def test_settings_persistence(client):
    """
    Verifies settings can be updated and retrieved.
    """
    client.post("/settings", json={"sampling_interval": "5", "persistence_n": "6"})
    resp = client.get("/settings")
    assert resp.status_code == 200
    settings = resp.json()
    assert float(settings.get("sampling_interval")) == 5.0
    assert int(settings.get("persistence_n")) == 6

    # Restore defaults
    client.post("/settings", json={"sampling_interval": "3", "persistence_n": "4"})
