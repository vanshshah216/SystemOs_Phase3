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

# Active diagnosis event IDs (to avoid duplicates while event is open)
_active_events: dict[str, int] = {}   # rule_id → event id
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


# ── Event helpers ──────────────────────────────────────────────────────────────

def _store_event(candidate, start_time: float, is_demo: bool) -> int:
    conn = get_connection()
    cur = conn.execute("""
        INSERT INTO diagnosis_event
            (start_time, end_time, severity, probable_cause, primary_process,
             evidence_json, status, created_at, is_demo)
        VALUES (?,?,?,?,?,?,?,?,?)
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

# Track per-process memory history for Rule E evaluation
_proc_mem_history: dict[str, deque] = {}
_proc_mem_lock = threading.Lock()
_sample_iteration_counter = 0


def _track_process_memory(proc_snaps: list[dict]) -> list[dict]:
    """Track memory time-series for running processes to detect sustained growth (Rule E)."""
    growth_candidates = []
    with _proc_mem_lock:
        for p in proc_snaps:
            name = p.get("name") or "unknown"
            mem_bytes = p.get("memory_bytes")
            if not mem_bytes:
                continue
            if name not in _proc_mem_history:
                _proc_mem_history[name] = deque(maxlen=40)
            dq = _proc_mem_history[name]
            dq.append(float(mem_bytes))

            if len(dq) >= 20:
                values = list(dq)
                slope = compute_trend_slope(values)
                # If slope >= 0.5 MB/sample
                if slope and slope >= (0.5 * 1024 * 1024):
                    growth_candidates.append({
                        "name": name,
                        "process_name": name,
                        "memory_slope": slope,
                        "sample_count": len(values),
                        "current_bytes": values[-1],
                        "baseline_bytes": values[0],
                    })
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

    # ── 1. Push to rolling history ──
    for metric in _history:
        _push_history(metric, sys_metric.get(metric))

    # ── 2. Statistical analysis for each metric ──
    anomalies: dict[str, AnomalyResult] = {}
    for metric in _history:
        val = sys_metric.get(metric)
        hist = _get_history(metric)
        anomalies[metric] = detect_anomaly(metric, val, hist)

    # ── 3. Persistence tracking ──
    for metric, anomaly in anomalies.items():
        update_persistence(metric, anomaly.is_anomaly, anomaly.current, ts)

    states = get_all_states()

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

    # ── 6. Process memory growth tracking for Rule E ──
    growth_candidates = _track_process_memory(proc_snaps)

    # ── 7. Apply diagnosis rules (A–E) ──
    candidates = evaluate_rules(
        anomalies,
        states,
        rankings,
        interval,
        memory_growth_candidates=growth_candidates,
    )

    # ── 8. Create / close events ──
    with _active_events_lock:
        fired_rules = {c.rule_id for c in candidates}

        # Open new events for new candidates
        for candidate in candidates:
            if candidate.rule_id not in _active_events:
                state = states.get(
                    "cpu_percent" if candidate.rule_id == "A" else
                    "ram_percent" if candidate.rule_id == "B" else
                    "disk_read_bytes" if candidate.rule_id == "C" else
                    "network_recv_bytes" if candidate.rule_id == "D" else
                    "ram_percent"
                )
                start = state.first_anomaly_time if state else ts
                event_id = _store_event(candidate, start, is_demo)
                _active_events[candidate.rule_id] = event_id
                logger.info(f"[Pipeline] Event #{event_id} opened: {candidate.probable_cause}")

            else:
                # Update the existing event evidence (replace JSON)
                event_id = _active_events[candidate.rule_id]
                conn = get_connection()
                conn.execute(
                    "UPDATE diagnosis_event SET evidence_json=?, primary_process=?, severity=? WHERE id=?",
                    (
                        json.dumps({
                            "evidence_items":    candidate.evidence_items,
                            "evidence_strength": candidate.evidence_strength,
                            "raw_stats":         candidate.raw_stats,
                        }),
                        candidate.primary_process,
                        candidate.severity,
                        event_id,
                    )
                )
                conn.commit()

        # Close events whose rule no longer fires
        for rule_id in list(_active_events.keys()):
            if rule_id not in fired_rules:
                _close_event(_active_events[rule_id], ts)
                logger.info(f"[Pipeline] Event #{_active_events[rule_id]} resolved (rule {rule_id})")
                del _active_events[rule_id]


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
