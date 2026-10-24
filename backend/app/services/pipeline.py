"""
services/pipeline.py – Orchestrates the complete SYSTEMOS analysis pipeline.

Flow:
  collect() → store() → get_historical_window() → calculate_baseline()
  → calculate_zscore() → calculate_percentiles() → calculate_trend()
  → detect_anomaly() → check_persistence() → correlate_resources()
  → rank_processes() → apply_diagnosis_rules() → create_event()
  → expose_event_via_api()

Called by the collector thread after every sample.
"""

import json
import time
import logging
import threading
from collections import deque
from typing import Optional

from app.database          import get_connection, get_setting
from app.diagnosis.anomaly     import detect_anomaly, AnomalyResult
from app.diagnosis.persistence import update_persistence, get_all_states
from app.diagnosis.attribution import (
    rank_processes_by_cpu, rank_processes_by_memory, rank_processes_by_disk_io,
    get_top_contributor,
)
from app.diagnosis.rules  import evaluate_rules
from app.diagnosis.rules import (
    MEMORY_GROWTH_MIN_DURATION_SECONDS,
    MEMORY_GROWTH_MIN_NET_MB,
    MEMORY_GROWTH_MIN_RATE_MB_PER_MINUTE,
    MEMORY_GROWTH_MIN_RISING_SAMPLE_RATIO,
    MEMORY_GROWTH_MIN_SAMPLES,
)
from app.diagnosis.evidence import compute_evidence_strength

logger = logging.getLogger("systemos.pipeline")

# ── Rolling history store ──────────────────────────────────────────────────────
# Kept in-memory for speed; each metric has a deque of float values.
_history_lock = threading.Lock()
_history: dict[str, deque] = {
    "cpu_percent":        deque(),
    "ram_percent":        deque(),
    "disk_read_bytes":    deque(),
    "disk_write_bytes":   deque(),
    "network_sent_bytes": deque(),
    "network_recv_bytes": deque(),
}
_demo_history: dict[str, deque] = {
    metric: deque() for metric in _history
}

# Active diagnosis event IDs (to avoid duplicates while event is open)
_active_events: dict[str, int] = {}   # incident_key → event id
_active_events_lock = threading.Lock()


def _get_window_size() -> int:
    return int(get_setting("rolling_window", "300"))


def _push_history(metric: str, value: Optional[float]):
    if value is None:
        return
    with _history_lock:
        dq = _history.get(metric)
        if dq is None:
            _history[metric] = deque()
            dq = _history[metric]
        dq.append(value)
        max_len = _get_window_size()
        while len(dq) > max_len:
            dq.popleft()


def _get_history(metric: str) -> list[float]:
    with _history_lock:
        return list(_history.get(metric, []))


def _get_history_for_mode(metric: str, is_demo: bool) -> list[float]:
    if not is_demo:
        return _get_history(metric)
    with _history_lock:
        return list(_demo_history.get(metric, []))


# ── Event helpers ──────────────────────────────────────────────────────────────

def _store_event(candidate, start_time: float, is_demo: bool) -> int:
    conn = get_connection()
    cur = conn.execute("""
        INSERT INTO diagnosis_event
            (start_time, end_time, severity, probable_cause, primary_process,
             evidence_json, status, created_at, is_demo,
             category, application_id, primary_display_name, primary_pid,
             primary_process_name, incident_key)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        start_time or time.time(),
        None,
        candidate.severity,
        candidate.probable_cause,
        candidate.primary_process,
        json.dumps({
            "evidence_items":    candidate.evidence_items,
            "evidence_strength": candidate.evidence_strength,
            "raw_stats":         candidate.raw_stats,
        }),
        "active",
        time.time(),
        1 if is_demo else 0,
        getattr(candidate, "category", None),
        getattr(candidate, "application_id", None),
        getattr(candidate, "primary_display_name", None) or candidate.primary_process,
        getattr(candidate, "primary_pid", None),
        getattr(candidate, "primary_process_name", None) or candidate.primary_process,
        getattr(candidate, "incident_key", None) or candidate.rule_id,
    ))
    conn.commit()
    return cur.lastrowid


def _close_event(event_id: int, end_time: float):
    conn = get_connection()
    conn.execute(
        "UPDATE diagnosis_event SET end_time=?, status='resolved' WHERE id=?",
        (end_time, event_id)
    )
    conn.commit()


from app.statistics.engine import compute_trend_slope
from app.database import prune_old_snapshots

# Track timestamped per-process memory history for Rule E evaluation (keyed by pid:create_time)
_proc_mem_history: dict[str, deque] = {}
_proc_mem_lock = threading.Lock()
_sample_iteration_counter = 0


def _track_process_memory(proc_snaps: list[dict], is_demo: bool = False) -> list[dict]:
    """Track memory time-series for running processes to detect sustained growth (Rule E)."""
    growth_candidates = []
    with _proc_mem_lock:
        active_keys: set[str] = set()
        for p in proc_snaps:
            pid = p.get("pid")
            name = p.get("name") or "unknown"
            mem_bytes = p.get("memory_bytes")
            timestamp = p.get("timestamp")
            if not mem_bytes or not pid or timestamp is None:
                continue
            # Skip SYSTEMOS monitor runtime processes
            ident_raw = p.get("identity_json")
            if ident_raw:
                try:
                    ident = json.loads(ident_raw)
                    if ident.get("role") == "monitor_runtime":
                        continue
                except Exception:
                    pass
            elif p.get("application_id") == "systemos-monitor":
                continue

            create_time = p.get("create_time") or 0.0
            hist_key = f"{int(is_demo)}:{pid}:{create_time:.6f}"
            active_keys.add(hist_key)
            if hist_key not in _proc_mem_history:
                _proc_mem_history[hist_key] = deque(maxlen=600)
            dq = _proc_mem_history[hist_key]
            if not dq or timestamp > dq[-1][0]:
                dq.append((float(timestamp), float(mem_bytes)))

            if len(dq) >= MEMORY_GROWTH_MIN_SAMPLES:
                points = list(dq)
                times = [point[0] for point in points]
                values = [point[1] for point in points]
                observation_seconds = times[-1] - times[0]
                growth_mb = (values[-1] - values[0]) / (1024 * 1024)
                slope = compute_trend_slope(values)
                slope_mb_per_minute = (
                    slope / (1024 * 1024) * (len(values) - 1) * 60 / observation_seconds
                    if slope and observation_seconds > 0
                    else 0.0
                )
                rising_sample_ratio = (
                    sum(1 for before, after in zip(values, values[1:]) if after > before)
                    / (len(values) - 1)
                )
                if (
                    observation_seconds >= MEMORY_GROWTH_MIN_DURATION_SECONDS
                    and growth_mb >= MEMORY_GROWTH_MIN_NET_MB
                    and slope_mb_per_minute >= MEMORY_GROWTH_MIN_RATE_MB_PER_MINUTE
                    and rising_sample_ratio >= MEMORY_GROWTH_MIN_RISING_SAMPLE_RATIO
                ):
                    growth_candidates.append({
                        "name": name,
                        "process_name": name,
                        "pid": pid,
                        "create_time": create_time,
                        "display_name": p.get("display_name") or name,
                        "application_id": p.get("application_id"),
                        "memory_slope": slope,
                        "sample_count": len(points),
                        "observation_seconds": observation_seconds,
                        "rising_sample_ratio": rising_sample_ratio,
                        "observation_start_time": times[0],
                        "current_bytes": values[-1],
                        "baseline_bytes": values[0],
                    })
        # Drop history for terminated PIDs
        prefix = f"{int(is_demo)}:"
        for stale in [k for k in _proc_mem_history if k.startswith(prefix) and k not in active_keys]:
            del _proc_mem_history[stale]
    return growth_candidates


# ── Main pipeline ──────────────────────────────────────────────────────────────

def run_analysis_pipeline(sys_metric: dict, proc_snaps: list[dict], is_demo: bool = False):
    """
    Run the full analysis pipeline for one collected sample.
    """
    global _sample_iteration_counter
    ts       = sys_metric["timestamp"]
    interval = float(get_setting("sampling_interval", "3"))

    _sample_iteration_counter += 1
    if _sample_iteration_counter % 600 == 0:  # ~every 30 minutes
        prune_old_snapshots()

    # ── 1. Compare the new sample against prior samples only. ──
    history = _demo_history if is_demo else _history
    anomalies: dict[str, AnomalyResult] = {}
    for metric in history:
        val = sys_metric.get(metric)
        hist = _get_history_for_mode(metric, is_demo)
        anomalies[metric] = detect_anomaly(metric, val, hist)

    # Add the sample after comparison so it cannot dilute its own anomaly score.
    for metric in history:
        value = sys_metric.get(metric)
        if value is not None:
            with _history_lock:
                dq = history[metric]
                dq.append(value)
                max_len = _get_window_size()
                while len(dq) > max_len:
                    dq.popleft()

    # ── 2. Persistence tracking ──
    state_prefix = "demo:" if is_demo else ""
    for metric, anomaly in anomalies.items():
        if anomaly.current is not None:
            update_persistence(f"{state_prefix}{metric}", anomaly.is_anomaly, anomaly.current, ts)

    states = {
        key[len(state_prefix):]: state
        for key, state in get_all_states().items()
        if key.startswith(state_prefix)
    }

    # ── 4. Count how many metrics are currently anomalous (for cross-resource) ──
    anomalous_count = sum(1 for a in anomalies.values() if a.is_anomaly)

    # ── 5. Process attribution (only if at least one metric is sustained) ──
    sustained_any = any(s.is_sustained for s in states.values())

    rankings = {}
    if sustained_any:
        # Use the earliest anomaly start time across all sustained metrics
        # This gives us the full event window for process attribution
        min_start = ts
        for s in states.values():
            if s.is_sustained and s.first_anomaly_time:
                min_start = min(min_start, s.first_anomaly_time)
        # Ensure at least N*interval seconds of window
        fallback_start = ts - int(get_setting("persistence_n", "4")) * interval * 3
        window_start = min(min_start, fallback_start)
        rankings["cpu"]    = rank_processes_by_cpu(window_start, ts, is_demo)
        rankings["memory"] = rank_processes_by_memory(window_start, ts, is_demo)
        rankings["disk"]   = rank_processes_by_disk_io(window_start, ts, is_demo)
        current_processes = {
            (p.get("pid"), float(p.get("create_time") or 0.0))
            for p in proc_snaps
            if p.get("pid")
        }
        for resource, ranking in rankings.items():
            rankings[resource] = [
                item for item in ranking
                if (item.get("pid"), float(item.get("create_time") or 0.0)) in current_processes
            ]

    # ── 6. Process memory growth tracking for Rule E ──
    growth_candidates = _track_process_memory(proc_snaps, is_demo=is_demo)

    # ── 7. Apply diagnosis rules (A–E) ──
    candidates = evaluate_rules(
        anomalies,
        states,
        rankings,
        interval,
        memory_growth_candidates=growth_candidates,
    )
    for candidate in candidates:
        candidate.raw_stats.setdefault("rule_id", candidate.rule_id)
        candidate.raw_stats.setdefault(
            "zscore_threshold",
            float(get_setting("zscore_threshold", "2.0")),
        )
        candidate.raw_stats.setdefault(
            "persistence_required",
            int(get_setting("persistence_n", "4")),
        )

    # ── 8. Create / close events ──
    with _active_events_lock:
        namespace = f"{int(is_demo)}:"
        conn = get_connection()
        active_rows = conn.execute(
            """SELECT id, incident_key FROM diagnosis_event
               WHERE status='active' AND is_demo=? AND incident_key IS NOT NULL
               ORDER BY id DESC""",
            (1 if is_demo else 0,),
        ).fetchall()
        for row in active_rows:
            _active_events.setdefault(f"{namespace}{row['incident_key']}", row["id"])

        fired_keys = {
            f"{namespace}{c.incident_key or c.rule_id}"
            for c in candidates
        }

        # Open new events for new candidates
        for candidate in candidates:
            incident = candidate.incident_key or candidate.rule_id
            ikey = f"{namespace}{incident}"
            if ikey not in _active_events:
                state = states.get(
                    "cpu_percent" if candidate.rule_id == "A" else
                    "ram_percent" if candidate.rule_id == "B" else
                    "disk_read_bytes" if candidate.rule_id == "C" else
                    "network_recv_bytes" if candidate.rule_id == "D" else
                    "ram_percent"
                )
                start = (
                    candidate.raw_stats.get("observation_start_time", ts)
                    if candidate.rule_id == "E"
                    else state.first_anomaly_time if state else ts
                )
                event_id = _store_event(candidate, start, is_demo)
                _active_events[ikey] = event_id
                logger.info(f"[Pipeline] Event #{event_id} opened: {candidate.probable_cause}")

            else:
                # Update the existing event evidence (replace JSON)
                event_id = _active_events[ikey]
                conn = get_connection()
                conn.execute(
                    """UPDATE diagnosis_event SET evidence_json=?, probable_cause=?, primary_process=?, severity=?,
                       primary_display_name=?, primary_pid=?, primary_process_name=?,
                       application_id=?, category=? WHERE id=?""",
                    (
                        json.dumps({
                            "evidence_items":    candidate.evidence_items,
                            "evidence_strength": candidate.evidence_strength,
                            "raw_stats":         candidate.raw_stats,
                        }),
                        candidate.probable_cause,
                        candidate.primary_process,
                        candidate.severity,
                        getattr(candidate, "primary_display_name", None) or candidate.primary_process,
                        getattr(candidate, "primary_pid", None),
                        getattr(candidate, "primary_process_name", None) or candidate.primary_process,
                        getattr(candidate, "application_id", None),
                        getattr(candidate, "category", None),
                        event_id,
                    )
                )
                conn.commit()

        # Close events whose incident no longer fires
        for ikey in list(_active_events.keys()):
            if ikey.startswith(namespace) and ikey not in fired_keys:
                _close_event(_active_events[ikey], ts)
                logger.info(f"[Pipeline] Event #{_active_events[ikey]} resolved ({ikey})")
                del _active_events[ikey]


def get_current_anomalies() -> dict:
    """Return the current anomaly results for all metrics (for the API)."""
    result = {}
    for metric in _history:
        hist = _get_history(metric)
        result[metric] = {
            "history_len": len(hist),
            "has_baseline": len(hist) >= 10,
        }
    return result
