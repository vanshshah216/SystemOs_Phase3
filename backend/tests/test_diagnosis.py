"""
tests/test_diagnosis.py – Unit tests for the diagnosis pipeline.
Run: pytest tests/test_diagnosis.py -v
"""

import pytest
from unittest.mock import patch, MagicMock

from app.diagnosis.anomaly      import AnomalyResult
from app.diagnosis.persistence  import PersistenceState, update_persistence, reset_state
from app.diagnosis.evidence     import compute_evidence_strength
from app.diagnosis.rules        import (
    rule_a_cpu_contention,
    rule_b_memory_pressure,
    rule_c_disk_bottleneck,
    rule_d_network_heavy,
    rule_e_process_memory_growth,
    evaluate_rules,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_anomaly(metric: str, current: float, is_anomaly: bool,
                  zscore: float = 3.0, mean: float = 50.0) -> AnomalyResult:
    return AnomalyResult(
        metric=metric, current=current,
        is_anomaly=is_anomaly, anomaly_reason="test",
        mean=mean, std=10.0, zscore=zscore,
        has_baseline=True,
    )


def make_sustained_state(metric: str, n: int = 5) -> PersistenceState:
    s = PersistenceState(metric=metric)
    s.consecutive_anomalies = n
    s.is_sustained = True
    s.first_anomaly_time = 1000.0
    s.last_anomaly_time  = 1000.0 + n * 3
    return s


def make_not_sustained(metric: str) -> PersistenceState:
    return PersistenceState(metric=metric)


# ── Persistence tests ──────────────────────────────────────────────────────────

def test_persistence_builds_up():
    reset_state("test_metric")
    with patch("app.diagnosis.persistence.get_setting", return_value="4"):
        for i in range(3):
            state = update_persistence("test_metric", True, 80.0, float(i))
        assert state.consecutive_anomalies == 3
        assert not state.is_sustained

def test_persistence_sustained():
    reset_state("test_metric2")
    with patch("app.diagnosis.persistence.get_setting", return_value="4"):
        for i in range(4):
            state = update_persistence("test_metric2", True, 80.0, float(i))
        assert state.is_sustained

def test_persistence_resets_on_normal():
    reset_state("test_metric3")
    with patch("app.diagnosis.persistence.get_setting", return_value="4"):
        for i in range(4):
            update_persistence("test_metric3", True, 80.0, float(i))
        state = update_persistence("test_metric3", False, 50.0, 5.0)
        assert not state.is_sustained
        assert state.consecutive_anomalies == 0


# ── Rule A – CPU ───────────────────────────────────────────────────────────────

def test_rule_a_fires_when_sustained():
    cpu = make_anomaly("cpu_percent", 85.0, True, zscore=3.5)
    state = make_sustained_state("cpu_percent", n=5)
    ranking = [{"pid": 100, "name": "Chrome", "avg_value": 60.0, "max_value": 85.0}]
    result = rule_a_cpu_contention(cpu, state, ranking)
    assert result is not None
    assert result.rule_id == "A"
    assert result.severity == "HIGH"
    assert result.primary_process == "Chrome"

def test_rule_a_does_not_fire_without_persistence():
    cpu = make_anomaly("cpu_percent", 85.0, True)
    state = make_not_sustained("cpu_percent")
    result = rule_a_cpu_contention(cpu, state, [])
    assert result is None

def test_rule_a_does_not_fire_when_not_anomaly():
    cpu = make_anomaly("cpu_percent", 50.0, False)
    state = make_sustained_state("cpu_percent")
    result = rule_a_cpu_contention(cpu, state, [])
    assert result is None


# ── Rule B – Memory ────────────────────────────────────────────────────────────

def test_rule_b_fires():
    ram = make_anomaly("ram_percent", 90.0, True, zscore=3.2)
    state = make_sustained_state("ram_percent")
    ranking = [{"pid": 200, "name": "Firefox", "avg_value": 3.0e9, "max_value": 4.0e9}]
    result = rule_b_memory_pressure(ram, state, ranking)
    assert result is not None
    assert result.rule_id == "B"
    assert "Firefox" in result.evidence_items[3]

def test_rule_b_includes_disk_correlation():
    ram = make_anomaly("ram_percent", 90.0, True)
    disk = make_anomaly("disk_read_bytes", 50e6, True)
    state = make_sustained_state("ram_percent")
    ranking = [{"pid": 200, "name": "Firefox", "avg_value": 3.0e9, "max_value": 4.0e9}]
    result = rule_b_memory_pressure(ram, state, ranking, disk_anomaly=disk)
    assert "disk" in result.probable_cause.lower()


# ── Rule C – Disk ──────────────────────────────────────────────────────────────

def test_rule_c_fires_on_read():
    rd = make_anomaly("disk_read_bytes",  50e6, True, zscore=4.0)
    wr = make_anomaly("disk_write_bytes", 10e6, False)
    state_r = make_sustained_state("disk_read_bytes")
    state_w = make_not_sustained("disk_write_bytes")
    ranking = [{"pid": 300, "name": "backup.exe", "avg_value": 30e6, "max_value": 60e6}]
    result = rule_c_disk_bottleneck(rd, wr, state_r, state_w, ranking)
    assert result is not None
    assert result.rule_id == "C"

def test_rule_c_does_not_fire_without_sustained():
    rd = make_anomaly("disk_read_bytes",  50e6, True)
    wr = make_anomaly("disk_write_bytes", 10e6, True)
    result = rule_c_disk_bottleneck(rd, wr, make_not_sustained("dr"), make_not_sustained("dw"), [])
    assert result is None


# ── Rule D – Network ───────────────────────────────────────────────────────────

def test_rule_d_fires():
    nr = make_anomaly("network_recv_bytes", 20e6, True, zscore=5.0)
    ns = make_anomaly("network_sent_bytes", 1e6, False)
    state_r = make_sustained_state("network_recv_bytes")
    state_s = make_not_sustained("network_sent_bytes")
    result = rule_d_network_heavy(nr, ns, state_r, state_s)
    assert result is not None
    assert result.rule_id == "D"


# ── Rule E – Process memory growth ────────────────────────────────────────────

def test_rule_e_fires_on_significant_growth():
    result = rule_e_process_memory_growth(
        process_name="Chrome",
        memory_slope=2.0 * 1024 * 1024,  # 2 MB/sample
        sample_count=25,
        current_bytes=4e9,
        baseline_bytes=1e9,
    )
    assert result is not None
    assert result.rule_id == "E"
    assert "not a confirmed memory leak" in " ".join(result.evidence_items).lower()

def test_rule_e_does_not_fire_on_small_growth():
    result = rule_e_process_memory_growth(
        process_name="Chrome",
        memory_slope=0.1 * 1024 * 1024,  # Only 0.1 MB/sample
        sample_count=25,
        current_bytes=1.1e9,
        baseline_bytes=1.0e9,
    )
    assert result is None


# ── Evidence strength ──────────────────────────────────────────────────────────

def test_evidence_strength_all_zeros():
    ev = compute_evidence_strength(
        zscore=0.0, consecutive_anomalies=0,
        process_ranking=[], correlated_metrics_count=0,
        total_monitored_metrics=4, trend_slope=0.0,
    )
    assert ev["score"] == 0.0

def test_evidence_strength_high():
    ranking = [
        {"avg_value": 80.0},
        {"avg_value": 10.0},
        {"avg_value": 5.0},
    ]
    ev = compute_evidence_strength(
        zscore=4.0, consecutive_anomalies=15,
        process_ranking=ranking, correlated_metrics_count=3,
        total_monitored_metrics=4, trend_slope=1.5,
    )
    assert ev["score"] > 60  # Should be strongly supported

def test_evidence_strength_capped_at_100():
    ranking = [{"avg_value": 100.0}]
    ev = compute_evidence_strength(
        zscore=99.0, consecutive_anomalies=999,
        process_ranking=ranking, correlated_metrics_count=10,
        total_monitored_metrics=4, trend_slope=999.0,
    )
    assert ev["score"] <= 100.0
