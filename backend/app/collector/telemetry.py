"""
collector/telemetry.py – psutil-based system and process telemetry collector.

Runs in a background thread, collecting system metrics and process snapshots
every `sampling_interval` seconds. Stores results in SQLite via database.py.
"""

import json
import time
import threading
import logging
from typing import Optional

import psutil

from app.database import get_connection, get_setting
from app.collector.app_identity import resolve_process_identity

logger = logging.getLogger("systemos.collector")

# ── Module-level state ─────────────────────────────────────────────────────────
_collector_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_collection_lock = threading.Lock()
_last_collection_time: Optional[float] = None
_collector_running = False

# Cumulative counters for delta calculations
_prev_disk_counters = None
_prev_net_counters = None
_prev_disk_sample_time: Optional[float] = None
_prev_net_sample_time: Optional[float] = None
_prev_proc_io: dict = {}  # (pid, create_time) -> (read, write)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (TypeError, ValueError):
        return None


# ── Collection ─────────────────────────────────────────────────────────────────

def collect_system_metrics(is_demo: bool = False) -> dict:
    """Collect one sample of system-level metrics. Returns a dict."""
    global _prev_disk_counters, _prev_net_counters
    global _prev_disk_sample_time, _prev_net_sample_time

    now = time.time()
    monotonic_now = time.monotonic()

    # CPU
    cpu_percent = _safe_float(psutil.cpu_percent(interval=None))
    cpu_times_pct = psutil.cpu_times_percent(interval=None)
    cpu_user   = _safe_float(getattr(cpu_times_pct, "user",   None))
    cpu_system = _safe_float(getattr(cpu_times_pct, "system", None))
    cpu_iowait = _safe_float(getattr(cpu_times_pct, "iowait", None))  # None on Windows

    # RAM
    vm = psutil.virtual_memory()
    ram_used      = _safe_int(vm.used)
    ram_available = _safe_int(vm.available)
    ram_percent   = _safe_float(vm.percent)

    # Convert cumulative OS counters to rates using the actual sample interval.
    disk_read_bytes = disk_write_bytes = None
    try:
        dc = psutil.disk_io_counters()
        elapsed = monotonic_now - _prev_disk_sample_time if _prev_disk_sample_time else None
        if dc and _prev_disk_counters and elapsed and elapsed > 0:
            read_delta = dc.read_bytes - _prev_disk_counters.read_bytes
            write_delta = dc.write_bytes - _prev_disk_counters.write_bytes
            if read_delta >= 0 and write_delta >= 0:
                disk_read_bytes = _safe_int(read_delta / elapsed)
                disk_write_bytes = _safe_int(write_delta / elapsed)
        _prev_disk_counters = dc
        if dc:
            _prev_disk_sample_time = monotonic_now
    except (OSError, AttributeError) as exc:
        logger.debug("Disk counters unavailable: %s", exc)

    # Network counters are also cumulative; report bytes per second.
    net_sent = net_recv = None
    try:
        nc = psutil.net_io_counters()
        elapsed = monotonic_now - _prev_net_sample_time if _prev_net_sample_time else None
        if nc and _prev_net_counters and elapsed and elapsed > 0:
            sent_delta = nc.bytes_sent - _prev_net_counters.bytes_sent
            recv_delta = nc.bytes_recv - _prev_net_counters.bytes_recv
            if sent_delta >= 0 and recv_delta >= 0:
                net_sent = _safe_int(sent_delta / elapsed)
                net_recv = _safe_int(recv_delta / elapsed)
        _prev_net_counters = nc
        if nc:
            _prev_net_sample_time = monotonic_now
    except (OSError, AttributeError) as exc:
        logger.debug("Network counters unavailable: %s", exc)
    return {
        "timestamp":          now,
        "cpu_percent":        cpu_percent,
        "cpu_user":           cpu_user,
        "cpu_system":         cpu_system,
        "cpu_iowait":         cpu_iowait,
        "ram_used":           ram_used,
        "ram_available":      ram_available,
        "ram_percent":        ram_percent,
        "disk_read_bytes":    disk_read_bytes,
        "disk_write_bytes":   disk_write_bytes,
        "network_sent_bytes": net_sent,
        "network_recv_bytes": net_recv,
        "is_demo":            1 if is_demo else 0,
    }


def collect_process_snapshots(is_demo: bool = False) -> list[dict]:
    """Collect one snapshot per running process. Returns list of dicts."""
    global _prev_proc_io
    now = time.time()
    snapshots = []
    new_prev: dict = {}

    for proc in psutil.process_iter(
        ["pid", "name", "cpu_percent", "memory_percent", "memory_info", "status", "create_time"]
    ):
        try:
            with proc.oneshot():
                info = proc.info
                pid = info["pid"]
                name = info.get("name") or "unknown"

                cpu_pct = _safe_float(info.get("cpu_percent"))
                mem_pct = _safe_float(info.get("memory_percent"))
                memory_info = info.get("memory_info")
                mem_bytes = _safe_int(memory_info.rss) if memory_info else None
                try:
                    threads = proc.num_threads()
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    threads = None

                # Parent lookup is intentionally omitted here: on Windows psutil
                # incurs a slow OS query per PID. Detailed analysis resolves it on demand.
                ppid = None
                status = info.get("status")
                create_time = _safe_float(info.get("create_time"))
                ident = resolve_process_identity(
                    pid,
                    proc=proc,
                    process_name=name,
                    create_time=create_time,
                )

                # Per-process I/O (not available on Windows without admin)
                io_read = io_write = None
                try:
                    pio = proc.io_counters()
                    process_key = (pid, int(create_time or 0))
                    prev = _prev_proc_io.get(process_key)
                    if prev:
                        read_delta = pio.read_bytes - prev[0]
                        write_delta = pio.write_bytes - prev[1]
                        io_read = _safe_int(read_delta) if read_delta >= 0 else None
                        io_write = _safe_int(write_delta) if write_delta >= 0 else None
                    new_prev[process_key] = (pio.read_bytes, pio.write_bytes)
                except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError, NotImplementedError):
                    pass

                snapshots.append({
                    "timestamp":      now,
                    "pid":            pid,
                    "name":           name,
                    "cpu_percent":    cpu_pct,
                    "memory_percent": mem_pct,
                    "memory_bytes":   mem_bytes,
                    "threads":        threads,
                    "io_read_bytes":  io_read,
                    "io_write_bytes": io_write,
                    "is_demo":        1 if is_demo else 0,
                    "ppid":           ppid,
                    "status":         status,
                    "create_time":    create_time,
                    "application_id": ident.application_id,
                    "display_name":   ident.display_name,
                    "identity_json":  json.dumps(ident.to_dict()),
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    _prev_proc_io = new_prev
    return snapshots


# ── Storage ────────────────────────────────────────────────────────────────────

def store_system_metric(m: dict):
    conn = get_connection()
    conn.execute("""
        INSERT INTO system_metric
            (timestamp, cpu_percent, cpu_user, cpu_system, cpu_iowait,
             ram_used, ram_available, ram_percent,
             disk_read_bytes, disk_write_bytes,
             network_sent_bytes, network_recv_bytes, is_demo)
        VALUES
            (:timestamp,:cpu_percent,:cpu_user,:cpu_system,:cpu_iowait,
             :ram_used,:ram_available,:ram_percent,
             :disk_read_bytes,:disk_write_bytes,
             :network_sent_bytes,:network_recv_bytes,:is_demo)
    """, m)
    conn.commit()


def store_process_snapshots(snapshots: list[dict]):
    if not snapshots:
        return
    normalized = []
    for s in snapshots:
        normalized.append({
            "ppid": None,
            "status": None,
            "create_time": None,
            "application_id": None,
            "display_name": s.get("name"),
            "identity_json": None,
            **s,
        })
    conn = get_connection()
    conn.executemany("""
        INSERT INTO process_snapshot
            (timestamp, pid, name, cpu_percent, memory_percent,
             memory_bytes, threads, io_read_bytes, io_write_bytes, is_demo,
             ppid, status, create_time, application_id, display_name, identity_json)
        VALUES
            (:timestamp,:pid,:name,:cpu_percent,:memory_percent,
             :memory_bytes,:threads,:io_read_bytes,:io_write_bytes,:is_demo,
             :ppid,:status,:create_time,:application_id,:display_name,:identity_json)
    """, normalized)
    conn.commit()


# ── Background thread ──────────────────────────────────────────────────────────

def _collection_loop():
    global _collector_running
    _collector_running = True
    logger.info("[Collector] Started")
    try:
        psutil.cpu_percent(interval=None)
        psutil.cpu_times_percent(interval=None)
        for proc in psutil.process_iter():
            try:
                proc.cpu_percent(interval=None)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
        time.sleep(0.5)

        while not _stop_event.is_set():
            cycle_started = time.monotonic()
            try:
                collect_once(is_demo=False)
            except Exception:
                logger.exception("[Collector] Collection cycle failed")

            try:
                interval = max(1.0, float(get_setting("sampling_interval", "3")))
            except (TypeError, ValueError):
                logger.exception("[Collector] Invalid sampling_interval setting")
                interval = 3.0
            remaining = max(0.0, interval - (time.monotonic() - cycle_started))
            _stop_event.wait(remaining)
    finally:
        _collector_running = False
        logger.info("[Collector] Stopped")


def start_collector():
    global _collector_thread, _stop_event
    if _collector_thread and _collector_thread.is_alive():
        return
    from app.services.application_lifecycle import reset_application_lifecycle_baseline
    reset_application_lifecycle_baseline()
    _stop_event.clear()
    _collector_thread = threading.Thread(target=_collection_loop, daemon=True, name="systemos-collector")
    _collector_thread.start()


def stop_collector():
    _stop_event.set()
    if _collector_thread:
        _collector_thread.join(timeout=10)


def get_collector_status() -> dict:
    return {
        "running": bool(_collector_thread and _collector_thread.is_alive() and _collector_running),
        "last_collection_time": _last_collection_time,
    }


def collect_once(is_demo: bool = False) -> dict:
    """Run one complete sample without racing the scheduled collector."""
    global _last_collection_time
    from app.services.pipeline import run_analysis_pipeline

    with _collection_lock:
        sample_started = time.monotonic()
        sys_metric = collect_system_metrics(is_demo=is_demo)
        proc_snaps = collect_process_snapshots(is_demo=is_demo)
        sample_timestamp = time.time()
        sys_metric["timestamp"] = sample_timestamp
        for snapshot in proc_snaps:
            snapshot["timestamp"] = sample_timestamp
        store_system_metric(sys_metric)
        store_process_snapshots(proc_snaps)
        _last_collection_time = sample_timestamp
        if not is_demo:
            from app.services.application_lifecycle import record_application_starts
            from app.services.applications import record_foreground_application
            record_application_starts(proc_snaps, sample_timestamp)
            record_foreground_application(proc_snaps, sample_timestamp)
        from app.diagnosis.process_analyzer import invalidate_process_cache
        invalidate_process_cache()
        try:
            run_analysis_pipeline(sys_metric, proc_snaps, is_demo=is_demo)
        except Exception:
            logger.exception("[Pipeline] Analysis failed after telemetry was stored")
        sample_duration = time.monotonic() - sample_started
        try:
            configured_interval = float(get_setting("sampling_interval", "3"))
        except (TypeError, ValueError):
            configured_interval = 3.0
        if sample_duration > configured_interval:
            logger.warning(
                "[Collector] Sample took %.1fs for %d processes; configured interval is %.1fs",
                sample_duration,
                len(proc_snaps),
                configured_interval,
            )
        return {
            "timestamp": sys_metric["timestamp"],
            "process_count": len(proc_snaps),
            "duration_seconds": round(sample_duration, 2),
        }
