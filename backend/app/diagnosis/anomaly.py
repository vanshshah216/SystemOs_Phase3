"""
diagnosis/anomaly.py – Per-metric anomaly detection.

Consults the statistical engine and returns a structured AnomalyResult
for each monitored metric.
"""

from dataclasses import dataclass, field
from typing import Optional

from app.statistics.engine import analyse_metric
from app.database import get_setting


@dataclass
class AnomalyResult:
    metric: str
    current: Optional[float]
    is_anomaly: bool
    anomaly_reason: Optional[str]
    # Statistical context
    mean: Optional[float] = None
    std: Optional[float] = None
    zscore: Optional[float] = None
    percentile_95: Optional[float] = None
    percentile_99: Optional[float] = None
    trend_slope: Optional[float] = None
    has_baseline: bool = False


def detect_anomaly(
    metric_name: str,
    current_value: Optional[float],
    history: list[float],
) -> AnomalyResult:
    """
    Detect whether current_value is anomalous relative to history.
    Returns an AnomalyResult with full statistical context.
    """
    if current_value is None:
        return AnomalyResult(
            metric=metric_name, current=None,
            is_anomaly=False, anomaly_reason=None
        )

    zscore_threshold    = float(get_setting("zscore_threshold",    "2.0"))
    percentile_threshold = int(get_setting("percentile_threshold", "95"))

    stats = analyse_metric(
        current=current_value,
        history=history,
        zscore_threshold=zscore_threshold,
        percentile_threshold=percentile_threshold,
    )

    return AnomalyResult(
        metric=metric_name,
        current=current_value,
        is_anomaly=stats["is_anomaly"],
        anomaly_reason=stats["anomaly_reason"],
        mean=stats["mean"],
        std=stats["std"],
        zscore=stats["zscore"],
        percentile_95=stats["percentile_95"],
        percentile_99=stats["percentile_99"],
        trend_slope=stats["trend_slope"],
        has_baseline=stats["has_baseline"],
    )
