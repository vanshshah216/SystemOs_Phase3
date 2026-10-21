"""
tests/test_statistics.py – Unit tests for the statistical engine.
Run: pytest tests/test_statistics.py -v
"""

import pytest
import math
from app.statistics.engine import (
    compute_mean, compute_std, compute_zscore,
    compute_percentiles, compute_trend_slope,
    analyse_metric, has_enough_data,
)

# ── Basic functions ────────────────────────────────────────────────────────────

def test_has_enough_data_false():
    assert has_enough_data([1, 2, 3]) is False

def test_has_enough_data_true():
    assert has_enough_data(list(range(10))) is True

def test_mean_insufficient():
    assert compute_mean([1, 2, 3]) is None

def test_mean_correct():
    data = [10.0] * 10
    assert compute_mean(data) == pytest.approx(10.0)

def test_std_zero_returns_none():
    data = [5.0] * 10
    # All same → std=0 → should return None (avoids div-by-zero)
    assert compute_std(data) is None

def test_std_correct():
    data = list(range(10))  # 0..9
    result = compute_std([float(x) for x in data])
    assert result == pytest.approx(3.0277, rel=1e-3)

def test_zscore_positive():
    # current=80, mean=50, std=10 → z=3.0
    assert compute_zscore(80, 50, 10) == pytest.approx(3.0)

def test_zscore_negative():
    assert compute_zscore(30, 50, 10) == pytest.approx(-2.0)

def test_zscore_zero_std():
    assert compute_zscore(80, 50, 0) is None

def test_percentiles_basic():
    data = list(range(100))  # 0..99, enough for p99
    pcts = compute_percentiles([float(x) for x in data])
    assert pcts["p50"] == pytest.approx(49.5, abs=0.5)
    assert pcts["p90"] == pytest.approx(89.1, abs=1.0)
    assert pcts["p95"] == pytest.approx(94.05, abs=1.0)
    assert pcts["p99"] == pytest.approx(98.01, abs=1.0)

def test_trend_slope_positive():
    # Linearly increasing → slope ≈ 1.0
    data = [float(i) for i in range(10)]
    slope = compute_trend_slope(data)
    assert slope == pytest.approx(1.0, abs=0.01)

def test_trend_slope_negative():
    # Linearly decreasing → slope ≈ -1.0
    data = [float(9 - i) for i in range(10)]
    slope = compute_trend_slope(data)
    assert slope == pytest.approx(-1.0, abs=0.01)

def test_trend_slope_flat():
    data = [5.0] * 10
    slope = compute_trend_slope(data)
    assert abs(slope) < 0.01


# ── Full analysis ──────────────────────────────────────────────────────────────

def test_analyse_metric_no_baseline():
    result = analyse_metric(80.0, [1.0, 2.0])
    assert result["has_baseline"] is False
    assert result["is_anomaly"] is False

def test_analyse_metric_anomaly_by_zscore():
    # Build a history centred around 50
    history = [50.0 + (i % 3) for i in range(20)]
    result = analyse_metric(80.0, history, zscore_threshold=2.0)
    assert result["has_baseline"] is True
    assert result["is_anomaly"] is True
    assert result["zscore"] is not None
    assert result["zscore"] > 2.0

def test_analyse_metric_normal():
    history = [50.0 + (i % 3) for i in range(20)]
    result = analyse_metric(51.0, history, zscore_threshold=2.0)
    assert result["is_anomaly"] is False
