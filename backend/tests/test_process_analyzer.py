"""
tests/test_process_analyzer.py – Unit and integration tests for explainable, rule-based
Process Activity Classification and Recommendation Engine.

Tests:
  - 6 Canonical Classifications:
      1. Active application
      2. High resource consumer
      3. Background process
      4. Protected/system process
      5. Review candidate
      6. Insufficient information
  - Low CPU usage alone NEVER classifies a process as unnecessary
  - Unfamiliar processes are NEVER assumed safe to terminate
  - Protected system processes are NEVER recommended for closure
  - Insufficient information handling for inaccessible / transient processes
  - Foreground activity window detection
  - Parent-child relationship tracking
  - All 7 required dimensions in evidence-based recommendations
  - API endpoint responses via FastAPI TestClient
"""

import time
import psutil
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.diagnosis.process_analyzer import (
    CLASS_ACTIVE_APP,
    CLASS_HIGH_RESOURCE,
    CLASS_BACKGROUND_PROC,
    CLASS_PROTECTED_SYSTEM,
    CLASS_REVIEW_CANDIDATE,
    CLASS_INSUFFICIENT_INFO,
    classify_activity,
    get_safety_tier,
    generate_recommendations,
    compute_process_trends,
    inspect_live_process,
    analyze_processes,
    get_system_network_connections_map,
    get_foreground_process_info,
)


@pytest.fixture
def client():
    return TestClient(app)


# ── 1. Classification Tests Across All 6 Canonical Categories ──────────────────

def test_classify_protected_system_process():
    # PID <= 4
    assert classify_activity("System", pid=4, cpu_percent=0.0, memory_mb=20.0) == CLASS_PROTECTED_SYSTEM
    # System core names
    assert classify_activity("svchost.exe", pid=1200, cpu_percent=1.2, memory_mb=45.0) == CLASS_PROTECTED_SYSTEM
    assert classify_activity("dwm.exe", pid=800, cpu_percent=2.5, memory_mb=120.0) == CLASS_PROTECTED_SYSTEM
    assert classify_activity("explorer.exe", pid=3400, cpu_percent=0.8, memory_mb=180.0) == CLASS_PROTECTED_SYSTEM
    assert classify_activity("Antimalware Service Executable", pid=4500, cpu_percent=8.0, memory_mb=220.0) == CLASS_PROTECTED_SYSTEM
    # Parent is smss.exe
    assert classify_activity("custom_sys.exe", pid=900, cpu_percent=0.0, memory_mb=10.0, parent_name="smss.exe") == CLASS_PROTECTED_SYSTEM


def test_classify_insufficient_information():
    # Inaccessible / AccessDenied
    assert classify_activity("secret.exe", pid=5000, cpu_percent=0.0, memory_mb=0.0, is_accessible=False) == CLASS_INSUFFICIENT_INFO
    # Terminated process
    assert classify_activity("dead.exe", pid=5001, cpu_percent=0.0, memory_mb=0.0, status="terminated") == CLASS_INSUFFICIENT_INFO
    # Brand new transient process (< 10 seconds runtime, < 2 samples)
    assert classify_activity("short_lived.exe", pid=5002, cpu_percent=5.0, memory_mb=50.0, runtime_seconds=3.0, sample_count=1) == CLASS_INSUFFICIENT_INFO


def test_classify_high_resource_consumer():
    # Elevated CPU (>= 15% normalized)
    assert classify_activity("video_transcoder.exe", pid=6001, cpu_percent=25.0, memory_mb=400.0, runtime_seconds=300.0, sample_count=10) == CLASS_HIGH_RESOURCE
    # Elevated Memory (>= 1.2 GB)
    assert classify_activity("large_cache.exe", pid=6002, cpu_percent=0.5, memory_mb=1800.0, runtime_seconds=400.0, sample_count=15) == CLASS_HIGH_RESOURCE
    # Elevated Disk IO (>= 5 MB/s)
    assert classify_activity("backup_tool.exe", pid=6003, cpu_percent=1.0, memory_mb=200.0, io_read_rate=6_000_000, runtime_seconds=200.0, sample_count=10) == CLASS_HIGH_RESOURCE


def test_classify_active_application():
    # Actively computing (CPU >= 1.0%)
    assert classify_activity("blender.exe", pid=7001, cpu_percent=4.5, memory_mb=600.0, runtime_seconds=500.0, sample_count=20) == CLASS_ACTIVE_APP
    # In foreground window
    assert classify_activity("notepad.exe", pid=7002, cpu_percent=0.0, memory_mb=40.0, is_foreground=True, runtime_seconds=200.0, sample_count=10) == CLASS_ACTIVE_APP
    # Active network sockets running
    assert classify_activity("network_sync.exe", pid=7003, cpu_percent=0.5, memory_mb=80.0, open_connections=4, status="running", runtime_seconds=300.0, sample_count=10) == CLASS_ACTIVE_APP


def test_classify_background_process():
    # Normal background process with low CPU and normal memory
    assert classify_activity("tailscale.exe", pid=8001, cpu_percent=0.05, memory_mb=60.0, runtime_seconds=1200.0, sample_count=30) == CLASS_BACKGROUND_PROC
    # Developer service operating within normal parameters
    assert classify_activity("postgres.exe", pid=8002, cpu_percent=0.1, memory_mb=150.0, runtime_seconds=1800.0, sample_count=40) == CLASS_BACKGROUND_PROC


# ── 2. Strict Constraint Checks (Low CPU & Unfamiliar Processes) ───────────────

def test_low_cpu_alone_never_triggers_review_candidate():
    """
    CRITICAL: A process must NEVER be classified as a Review Candidate simply
    because its CPU usage is low or 0%. Normal idle background processes must
    remain classified as 'Background process'.
    """
    # Low CPU with modest memory -> MUST be Background process, NOT Review candidate
    result = classify_activity(
        name="normal_service.exe",
        pid=8101,
        cpu_percent=0.0,
        memory_mb=75.0,
        runtime_seconds=600.0,
        sample_count=20,
    )
    assert result == CLASS_BACKGROUND_PROC
    assert result != CLASS_REVIEW_CANDIDATE

    # Another background tool with 0.05% CPU and 120MB RAM
    result2 = classify_activity(
        name="custom_worker.exe",
        pid=8102,
        cpu_percent=0.05,
        memory_mb=120.0,
        runtime_seconds=1200.0,
        sample_count=50,
    )
    assert result2 == CLASS_BACKGROUND_PROC


def test_unfamiliar_process_not_assumed_safe_to_terminate():
    """
    CRITICAL: An unfamiliar binary must NEVER be marked as 'safe_to_review'
    or assumed harmless to close. Its safety tier must default to 'review_with_caution'.
    """
    safety = get_safety_tier("unfamiliar_proprietary_tool.exe", pid=8201)
    assert safety == "review_with_caution"
    assert safety != "safe_to_review"


# ── 3. Review Candidate Specific Rules ─────────────────────────────────────────

def test_review_candidate_idle_high_memory_app():
    # Known user desktop app (chrome.exe) with >= 350 MB RAM idle for >= 5 minutes
    result = classify_activity(
        name="chrome.exe",
        pid=9001,
        cpu_percent=0.05,
        memory_mb=650.0,
        runtime_seconds=400.0,
        sample_count=25,
        is_foreground=False,
    )
    assert result == CLASS_REVIEW_CANDIDATE


def test_review_candidate_background_cpu_drain():
    # Background process consuming 14% CPU without user focus
    result = classify_activity(
        name="background_indexer.exe",
        pid=9002,
        cpu_percent=14.0,
        memory_mb=250.0,
        runtime_seconds=180.0,
        sample_count=15,
        is_foreground=False,
    )
    assert result == CLASS_REVIEW_CANDIDATE


def test_review_candidate_redundant_helper():
    # Process matching helper/updater pattern with >= 120 MB RAM
    result = classify_activity(
        name="app_crash_reporter.exe",
        pid=9003,
        cpu_percent=0.0,
        memory_mb=150.0,
        runtime_seconds=200.0,
        sample_count=10,
    )
    assert result == CLASS_REVIEW_CANDIDATE


def test_review_candidate_sustained_memory_growth():
    # Monotonic memory growth slope (Rule E candidate)
    result = classify_activity(
        name="data_collector.exe",
        pid=9004,
        cpu_percent=0.8,
        memory_mb=500.0,
        runtime_seconds=600.0,
        sample_count=20,
        memory_slope_mb=0.75,
        net_growth_mb=120.0,
    )
    assert result == CLASS_REVIEW_CANDIDATE


# ── 4. Evidence-Based Recommendations Tests (All 7 Dimensions) ─────────────────

def test_recommendation_all_seven_dimensions_present():
    """
    Verifies that every recommendation provides all 7 required explanation fields:
      1. activity_description
      2. resources_consumed
      3. is_usage_unusual
      4. classification_reason
      5. investigation_advice
      6. manual_closure_guidance
      7. safety_and_uncertainty
    """
    profiles = [{
        "pid": 9501,
        "name": "chrome.exe",
        "activity_class": CLASS_REVIEW_CANDIDATE,
        "safety_tier": "safe_to_review",
        "memory_mb": 850.0,
        "cpu_percent": 0.05,
        "runtime_seconds": 900.0,
        "threads": 24,
        "open_connections": 8,
        "parent_name": "explorer.exe",
        "is_foreground": False,
        "trends": {"cpu_trend": "stable", "sample_count": 30},
    }]
    recs = generate_recommendations(profiles)
    assert len(recs) == 1
    rec = recs[0]

    # Check that all 7 required dimensions exist and contain rich text
    assert "activity_description" in rec and len(rec["activity_description"]) > 10
    assert "resources_consumed" in rec and "MB" in rec["resources_consumed"]
    assert "is_usage_unusual" in rec and len(rec["is_usage_unusual"]) > 10
    assert "classification_reason" in rec and CLASS_REVIEW_CANDIDATE in rec["classification_reason"]
    assert "investigation_advice" in rec and len(rec["investigation_advice"]) > 10
    assert "manual_closure_guidance" in rec and "manual" in rec["manual_closure_guidance"].lower()
    assert "safety_and_uncertainty" in rec and "safety" in rec["safety_and_uncertainty"].lower()

    # Reclaimable metrics & evidence bullets
    assert rec["reclaimable_memory_mb"] > 600
    assert len(rec["evidence"]) >= 3


def test_protected_system_never_recommended():
    """Protected system processes must NEVER be recommended for closure."""
    profiles = [{
        "pid": 4,
        "name": "System",
        "activity_class": CLASS_PROTECTED_SYSTEM,
        "safety_tier": "protected_system",
        "memory_mb": 3000.0,
        "cpu_percent": 45.0,
        "runtime_seconds": 999999.0,
        "trends": {},
    }]
    recs = generate_recommendations(profiles)
    assert len(recs) == 0


def test_insufficient_info_never_recommended_for_closure():
    """Processes with incomplete telemetry must not be recommended for closure."""
    profiles = [{
        "pid": 9999,
        "name": "Access Denied",
        "activity_class": CLASS_INSUFFICIENT_INFO,
        "safety_tier": "uncertain",
        "memory_mb": 0.0,
        "cpu_percent": 0.0,
        "runtime_seconds": 0.0,
        "trends": {},
    }]
    recs = generate_recommendations(profiles)
    assert len(recs) == 0


# ── 5. Trend Calculations & PID Reuse Tests ────────────────────────────────────

def test_compute_process_trends_empty():
    trends = compute_process_trends(pid=999999)
    assert trends["has_history"] is False
    assert trends["sample_count"] == 0


def test_compute_process_trends_with_mock_data():
    now = time.time()
    mock_rows = [
        {"timestamp": now - 30 + i * 3, "cpu_percent": 10.0 + i * 4.0, "memory_bytes": int((200 + i * 10) * 1024 * 1024)}
        for i in range(10)
    ]
    with patch("app.diagnosis.process_analyzer.get_connection") as mock_conn:
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = mock_rows
        mock_conn.return_value.execute.return_value = mock_cur

        trends = compute_process_trends(pid=1234, current_create_time=now - 50)
        assert trends["has_history"] is True
        assert trends["sample_count"] == 10
        assert trends["cpu_trend"] == "rising"
        assert trends["memory_trend"] == "growing"
        assert trends["growth_mb"] > 0


# ── 6. Live Telemetry & Network Enumeration Tests ──────────────────────────────

def test_system_network_connections_map():
    conn_map = get_system_network_connections_map()
    assert isinstance(conn_map, dict)
    if conn_map:
        first_pid = next(iter(conn_map))
        assert "total" in conn_map[first_pid]
        assert "established" in conn_map[first_pid]
        assert "listen" in conn_map[first_pid]


def test_inspect_current_live_process():
    import os
    current_pid = os.getpid()
    prof = inspect_live_process(current_pid)
    assert prof is not None
    assert prof["pid"] == current_pid
    assert prof["is_accessible"] is True
    assert prof["activity_class"] in (
        CLASS_ACTIVE_APP,
        CLASS_HIGH_RESOURCE,
        CLASS_BACKGROUND_PROC,
        CLASS_PROTECTED_SYSTEM,
        CLASS_REVIEW_CANDIDATE,
        CLASS_INSUFFICIENT_INFO,
    )
    assert "activity_key" in prof
    assert "safety_tier" in prof
    assert "open_connections" in prof


def test_inspect_nonexistent_process():
    prof = inspect_live_process(99999999)
    assert prof is None


# ── 7. FastAPI REST API Integration Tests ──────────────────────────────────────

def test_api_get_processes(client):
    res = client.get("/processes?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "processes" in data


def test_api_get_process_analyzer(client):
    res = client.get("/processes/analyzer?limit=15")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "recommendations" in data
    assert "processes" in data
    assert "categories_breakdown" in data

    # Verify summary counts all 6 canonical categories
    summary = data["summary"]
    assert "active_application_count" in summary
    assert "high_resource_consumer_count" in summary
    assert "background_process_count" in summary
    assert "protected_system_count" in summary
    assert "review_candidate_count" in summary
    assert "insufficient_information_count" in summary
    assert summary["network_metrics_supported"] is True


def test_api_get_recommendations(client):
    res = client.get("/processes/recommendations?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "recommendations" in data
    assert "potential_reclaimable_memory_mb" in data

    # If any recommendations exist, verify the 7 explanation dimensions
    for rec in data["recommendations"]:
        assert "activity_description" in rec
        assert "resources_consumed" in rec
        assert "is_usage_unusual" in rec
        assert "classification_reason" in rec
        assert "investigation_advice" in rec
        assert "manual_closure_guidance" in rec
        assert "safety_and_uncertainty" in rec


def test_api_get_categories(client):
    res = client.get("/processes/categories")
    assert res.status_code == 200
    data = res.json()
    assert "categories_breakdown" in data
    breakdown = data["categories_breakdown"]
    # All 6 category keys should be present
    for key in (
        "active_application",
        "high_resource_consumer",
        "background_process",
        "protected_system_process",
        "review_candidate",
        "insufficient_information",
    ):
        assert key in breakdown
        assert "label" in breakdown[key]
        assert "count" in breakdown[key]


def test_api_get_single_process_analysis(client):
    import os
    res = client.get(f"/processes/{os.getpid()}/analysis")
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    assert data["profile"]["pid"] == os.getpid()
    assert "recommendations" in data


def test_api_get_single_process_analysis_not_found(client):
    res = client.get("/processes/99999999/analysis")
    assert res.status_code == 404


# ── 8. Advanced Telemetry, Anomaly Attribution & Safety Guard Tests ─────────────

def test_anomaly_attribution_integration():
    """
    Verifies that a process attributed to an active diagnosis anomaly
    is elevated to High resource consumer and generates an active anomaly recommendation.
    """
    profiles = [{
        "pid": 9801,
        "name": "data_cruncher.exe",
        "activity_class": CLASS_HIGH_RESOURCE,
        "safety_tier": "safe_to_review",
        "memory_mb": 650.0,
        "cpu_percent": 22.0,
        "runtime_seconds": 300.0,
        "threads": 16,
        "open_connections": 2,
        "parent_name": "explorer.exe",
        "is_foreground": False,
        "attributed_events": [{
            "id": 101,
            "severity": "HIGH",
            "probable_cause": "Sustained CPU Saturation (Rule A)",
            "start_time": time.time() - 120,
        }],
        "trends": {"cpu_trend": "rising", "sample_count": 10},
    }]

    recs = generate_recommendations(profiles)
    assert len(recs) >= 1
    rec = recs[0]
    assert rec["category"] == "active_anomaly_attribution"
    assert "Sustained CPU Saturation" in rec["what_process_is_doing"]
    assert "Sustained CPU Saturation" in rec["is_usage_unusual"]
    assert "High Priority" in rec["should_investigate"]
    assert rec["severity"] == "HIGH"


def test_parent_child_relationship_handling():
    """
    Verifies that parent-child lineage (e.g. child of wininit/smss) correctly
    classifies core services as protected system processes.
    """
    assert classify_activity(
        name="lsass.exe",
        pid=650,
        cpu_percent=0.1,
        memory_mb=30.0,
        parent_name="wininit.exe",
        ppid=600,
    ) == CLASS_PROTECTED_SYSTEM

    # User process spawned by explorer
    assert classify_activity(
        name="calculator.exe",
        pid=9850,
        cpu_percent=0.0,
        memory_mb=45.0,
        parent_name="explorer.exe",
        ppid=3000,
        runtime_seconds=120.0,
        sample_count=5,
    ) == CLASS_BACKGROUND_PROC


def test_foreground_activity_mocked_telemetry():
    """
    Verifies that foreground status promotes an interactive application to Active application.
    """
    # Without foreground: idle calculator is background process
    res_bg = classify_activity(
        name="calculator.exe",
        pid=9851,
        cpu_percent=0.0,
        memory_mb=45.0,
        is_foreground=False,
        runtime_seconds=120.0,
        sample_count=5,
    )
    assert res_bg == CLASS_BACKGROUND_PROC

    # With foreground window focus: promoted to Active application
    res_fg = classify_activity(
        name="calculator.exe",
        pid=9851,
        cpu_percent=0.0,
        memory_mb=45.0,
        is_foreground=True,
        runtime_seconds=120.0,
        sample_count=5,
    )
    assert res_fg == CLASS_ACTIVE_APP


def test_no_automatic_process_termination():
    """
    CRITICAL: Validates that SYSTEMOS NEVER implements or executes automatic
    process termination. Recommendations must only offer manual closure guidance.
    """
    import inspect
    from app.diagnosis import process_analyzer

    # Check process_analyzer source code does not invoke terminate or kill on processes
    source = inspect.getsource(process_analyzer)
    assert ".terminate()" not in source, "Automatic process termination method (.terminate()) detected!"
    assert "os.kill(" not in source, "Automatic process kill (os.kill) detected!"

    # Ensure all recommendations specify manual closure only
    profiles = [{
        "pid": 9901,
        "name": "test_app.exe",
        "activity_class": CLASS_REVIEW_CANDIDATE,
        "safety_tier": "safe_to_review",
        "memory_mb": 900.0,
        "cpu_percent": 0.05,
        "runtime_seconds": 600.0,
        "parent_name": "explorer.exe",
        "is_foreground": False,
        "trends": {},
    }]
    recs = generate_recommendations(profiles)
    for rec in recs:
        guidance = rec.get("manual_closure_guidance", "").lower()
        guidance_considered = rec.get("manual_closure_considered", "").lower()
        combined = guidance + " " + guidance_considered
        assert "manual" in combined or "exit" in combined or "restart" in combined
        assert "automatically terminate" not in combined
        assert "kill" not in combined


def test_access_denied_process_handling(monkeypatch):
    """
    Verifies that when psutil encounters AccessDenied on protected Windows processes,
    inspect_live_process returns an inaccessible profile rather than dropping it or crashing.
    """
    class MockAccessDeniedProc:
        def __init__(self, pid):
            self.pid = pid
        def oneshot(self):
            class _Ctx:
                def __init__(self, pid):
                    self.pid = pid
                def __enter__(self):
                    raise psutil.AccessDenied(pid=self.pid)
                def __exit__(self, *args):
                    pass
            return _Ctx(self.pid)
        def name(self):
            return "Secure System" if self.pid == 4 else "ProtectedService.exe"

    monkeypatch.setattr(psutil, "Process", MockAccessDeniedProc)

    # Protected core process (PID 4)
    prof_pid4 = inspect_live_process(4)
    assert prof_pid4 is not None
    assert prof_pid4["is_accessible"] is False
    assert prof_pid4["activity_class"] == CLASS_PROTECTED_SYSTEM
    assert prof_pid4["safety_tier"] == "protected_system"

    # Inaccessible third-party process
    prof_other = inspect_live_process(9999)
    assert prof_other is not None
    assert prof_other["is_accessible"] is False
    assert prof_other["activity_class"] == CLASS_INSUFFICIENT_INFO


def test_empty_process_list_and_fallback(monkeypatch):
    """
    Verifies that analyze_processes falls back to live process iteration if database
    snapshots are temporarily missing, ensuring processes are never silently empty.
    """
    # Clean analyzer cache
    from app.diagnosis import process_analyzer
    process_analyzer._ANALYZER_CACHE = {"timestamp": 0.0, "profiles": []}

    res = analyze_processes(limit=10)
    assert "summary" in res
    assert "processes" in res
    assert res["summary"]["total_analyzed"] > 0
    assert len(res["processes"]) > 0


def test_process_analyzer_cache_ttl():
    """
    Verifies that calling analyze_processes multiple times within the 3.0s TTL
    returns cached results instantaneously (< 0.05s).
    """
    res1 = analyze_processes(limit=20)
    t0 = time.time()
    res2 = analyze_processes(limit=10)
    elapsed = time.time() - t0
    assert elapsed < 0.05, f"Cached call took too long: {elapsed:.3f}s"
    assert len(res2["processes"]) == 10
    assert res2["summary"]["total_analyzed"] == res1["summary"]["total_analyzed"]


def test_collector_telemetry_snapshot_execution():
    """
    Verifies that collect_process_snapshots returns valid live process snapshots
    without blocking or throwing exceptions.
    """
    from app.collector.telemetry import collect_process_snapshots
    snapshots = collect_process_snapshots()
    assert isinstance(snapshots, list)
    assert len(snapshots) > 0
    first = snapshots[0]
    assert "pid" in first
    assert "name" in first
    assert "cpu_percent" in first
    assert "memory_percent" in first

