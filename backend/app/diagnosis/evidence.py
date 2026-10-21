"""
diagnosis/evidence.py – Evidence strength calculation.

Evidence Strength = 0.30*A + 0.25*P + 0.20*C + 0.15*R + 0.10*T

Where:
  A = Anomaly strength    (z-score normalized to [0,1])
  P = Persistence strength (consecutive/max capped at 1)
  C = Process contribution (top-process avg / total, normalized)
  R = Cross-resource support (fraction of correlated resources showing anomaly)
  T = Trend strength      (|slope| normalized)

All components are in [0, 1]. The result is clamped to [0, 1].
"""

from typing import Optional


MAX_ZSCORE_FOR_NORM   = 5.0   # z-score above this → A = 1.0
MAX_PERSISTENCE_NORM  = 20    # consecutive samples above this → P = 1.0
MAX_TREND_SLOPE_NORM  = 2.0   # |slope| above this → T = 1.0


def _norm(value: float, max_val: float) -> float:
    """Normalize value to [0, 1] clamped at max_val."""
    return min(abs(value) / max_val, 1.0) if max_val > 0 else 0.0


def compute_evidence_strength(
    zscore: Optional[float],
    consecutive_anomalies: int,
    process_ranking: list[dict],
    correlated_metrics_count: int,
    total_monitored_metrics: int,
    trend_slope: Optional[float],
) -> dict:
    """
    Compute the evidence strength score and its breakdown.

    Returns:
        {
          "score": float (0-100),
          "A": float, "P": float, "C": float, "R": float, "T": float,
          "components": { explanations }
        }
    """
    # A – Anomaly strength from z-score
    A = _norm(zscore, MAX_ZSCORE_FOR_NORM) if zscore is not None else 0.0

    # P – Persistence strength
    P = _norm(consecutive_anomalies, MAX_PERSISTENCE_NORM)

    # C – Process contribution (top process avg relative to sum of all)
    C = 0.0
    if process_ranking:
        top_avg = process_ranking[0].get("avg_value", 0) or 0
        total_avg = sum(r.get("avg_value", 0) or 0 for r in process_ranking)
        if total_avg > 0:
            C = min(top_avg / total_avg, 1.0)

    # R – Cross-resource support
    R = 0.0
    if total_monitored_metrics > 0:
        R = min(correlated_metrics_count / total_monitored_metrics, 1.0)

    # T – Trend strength (absolute slope)
    T = _norm(trend_slope, MAX_TREND_SLOPE_NORM) if trend_slope is not None else 0.0

    # Weighted sum
    raw_score = 0.30 * A + 0.25 * P + 0.20 * C + 0.15 * R + 0.10 * T
    score = round(min(raw_score, 1.0) * 100, 1)

    return {
        "score": score,
        "A": round(A * 100, 1),
        "P": round(P * 100, 1),
        "C": round(C * 100, 1),
        "R": round(R * 100, 1),
        "T": round(T * 100, 1),
        "components": {
            "anomaly_strength":     f"Z-score normalized: {round(A*100,1)}%",
            "persistence_strength": f"{consecutive_anomalies} consecutive samples: {round(P*100,1)}%",
            "process_contribution": f"Top process share: {round(C*100,1)}%",
            "cross_resource":       f"{correlated_metrics_count}/{total_monitored_metrics} correlated metrics: {round(R*100,1)}%",
            "trend_strength":       f"Trend slope: {round(T*100,1)}%",
        }
    }
