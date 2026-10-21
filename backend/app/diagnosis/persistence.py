"""
diagnosis/persistence.py – Consecutive-sample persistence tracker.

Tracks how many consecutive samples each metric has been anomalous.
A sustained event is only declared when the count reaches N (configurable).
A single spike that returns to normal is labelled TRANSIENT and never
escalates to a DiagnosisEvent.

State is held in a module-level dict so it persists across collection cycles.
"""

from dataclasses import dataclass, field
from typing import Optional
import time

from app.database import get_setting


@dataclass
class PersistenceState:
    metric: str
    consecutive_anomalies: int = 0
    first_anomaly_time: Optional[float] = None
    last_anomaly_time: Optional[float] = None
    is_sustained: bool = False
    # History of (timestamp, value) during the current streak
    streak_samples: list = field(default_factory=list)


# Module-level state: metric_name → PersistenceState
_states: dict[str, PersistenceState] = {}


def get_state(metric: str) -> PersistenceState:
    if metric not in _states:
        _states[metric] = PersistenceState(metric=metric)
    return _states[metric]


def reset_state(metric: str):
    _states[metric] = PersistenceState(metric=metric)


def update_persistence(
    metric: str,
    is_anomaly: bool,
    current_value: Optional[float],
    timestamp: float,
) -> PersistenceState:
    """
    Update the persistence tracker for a metric.

    Returns the updated PersistenceState. If the anomaly ends, the state
    is reset to zero and is_sustained becomes False.
    """
    n = int(get_setting("persistence_n", "4"))
    state = get_state(metric)

    if is_anomaly:
        state.consecutive_anomalies += 1
        if state.first_anomaly_time is None:
            state.first_anomaly_time = timestamp
        state.last_anomaly_time = timestamp
        state.streak_samples.append({"timestamp": timestamp, "value": current_value})
        # Sustained once we cross the threshold
        if state.consecutive_anomalies >= n:
            state.is_sustained = True
    else:
        # Anomaly ended — reset
        state.consecutive_anomalies = 0
        state.first_anomaly_time    = None
        state.last_anomaly_time     = None
        state.is_sustained          = False
        state.streak_samples        = []

    return state


def get_all_states() -> dict[str, PersistenceState]:
    return dict(_states)
