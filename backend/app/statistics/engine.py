"""
statistics/engine.py – Core statistical computation for SYSTEMOS.

All functions are pure and operate on lists/arrays of floats.
No side effects – the diagnosis layer owns state.
"""

import math
from typing import Optional

import numpy as np

# ── Minimum samples before stats are meaningful ───────────────────────────────
MIN_SAMPLES = 10


def has_enough_data(values: list) -> bool:
    return len(values) >= MIN_SAMPLES


def compute_mean(values: list[float]) -> Optional[float]:
    if not has_enough_data(values):
        return None
    return float(np.mean(values))


def compute_std(values: list[float]) -> Optional[float]:
    if not has_enough_data(values):
        return None
    std = float(np.std(values, ddof=1))  # sample std
    return std if std > 0 else None


def compute_zscore(current: float, mean: float, std: float) -> Optional[float]:
    """Z-score: how many standard deviations current is from the mean."""
    if std is None or std == 0:
        return None
    return (current - mean) / std


def compute_percentiles(values: list[float]) -> dict:
    """Returns P50, P90, P95, P99 of the provided values."""
    if not has_enough_data(values):
        return {"p50": None, "p90": None, "p95": None, "p99": None}
    arr = np.array(values)
    return {
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
        "p95": float(np.percentile(arr, 95)),
        "p99": float(np.percentile(arr, 99)),
    }


def compute_trend_slope(values: list[float]) -> Optional[float]:
    """
    Linear regression slope over the provided values.
    Positive slope → rising trend. Negative slope → falling trend.
    Returns slope per sample (not per second).
    """
    if not has_enough_data(values):
        return None
    n = len(values)
    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)
    # np.polyfit degree 1
    try:
        slope, _ = np.polyfit(x, y, 1)
        return float(slope)
    except np.linalg.LinAlgError:
        return None


def build_baseline(values: list[float], window_start: float, window_end: float, metric_name: str) -> dict:
    """
    Build a complete baseline dict from a list of historical values.
    Returns a dict suitable for storage in baseline_statistics.
    """
    mean  = compute_mean(values)
    std   = compute_std(values)
    pcts  = compute_percentiles(values)
    slope = compute_trend_slope(values)

    return {
        "metric_name":      metric_name,
        "window_start":     window_start,
        "window_end":       window_end,
        "mean":             mean,
        "standard_deviation": std,
        "percentile_50":    pcts["p50"],
        "percentile_90":    pcts["p90"],
        "percentile_95":    pcts["p95"],
        "percentile_99":    pcts["p99"],
        "trend_slope":      slope,
    }


def analyse_metric(
    current: float,
    history: list[float],
    zscore_threshold: float = 2.0,
    percentile_threshold: int = 95,
) -> dict:
    """
    Full statistical analysis for a single metric value against its history.

    Returns a dict with:
      - mean, std, zscore, percentiles, trend_slope
      - is_anomaly: bool
      - anomaly_reason: str or None
      - has_baseline: bool
    """
    if not has_enough_data(history):
        return {
            "has_baseline": False,
            "mean": None, "std": None, "zscore": None,
            "percentile_50": None, "percentile_90": None,
            "percentile_95": None, "percentile_99": None,
            "trend_slope": None,
            "is_anomaly": False,
            "anomaly_reason": None,
        }

    mean  = compute_mean(history)
    std   = compute_std(history)
    pcts  = compute_percentiles(history)
    slope = compute_trend_slope(history)
    zscore = compute_zscore(current, mean, std) if (mean is not None and std) else None

    is_anomaly = False
    anomaly_reason = None

    # Condition 1: Z-score exceeds threshold
    if zscore is not None and abs(zscore) > zscore_threshold:
        is_anomaly = True
        anomaly_reason = f"z-score {zscore:.2f} > threshold {zscore_threshold}"

    # Condition 2: value exceeds historical Pxx
    pct_key = f"p{percentile_threshold}"
    pct_val = pcts.get(pct_key)
    if pct_val is not None and current > pct_val and not is_anomaly:
        is_anomaly = True
        anomaly_reason = f"value {current:.1f} > P{percentile_threshold} {pct_val:.1f}"

    return {
        "has_baseline": True,
        "mean": mean,
        "std": std,
        "zscore": zscore,
        "percentile_50": pcts["p50"],
        "percentile_90": pcts["p90"],
        "percentile_95": pcts["p95"],
        "percentile_99": pcts["p99"],
        "trend_slope": slope,
        "is_anomaly": is_anomaly,
        "anomaly_reason": anomaly_reason,
    }
