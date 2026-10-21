"""
collector/telemetry.py – psutil-based system and process telemetry collector.

Runs in a background thread, collecting system metrics and process snapshots
every `sampling_interval` seconds. Stores results in SQLite via database.py.
"""

import time
import threading
import logging
from typing import Optional

import psutil

from app.database import get_connection, get_setting

logger = logging.getLogger("systemos.collector")

# ── Module-level state ─────────────────────────────────────────────────────────
_collector_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_last_collection_time: Optional[float] = None
_collector_running = False

# Cumulative counters for delta calculations
_prev_disk_counters = None
_prev_net_counters = None
_prev_proc_io: dict = {}  # pid -> (read, write)


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

    now = time.time()

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

    # Disk I/O deltas
    disk_read_bytes = disk_write_bytes = None
    try:
        dc = psutil.disk_io_counters()
        if dc and _prev_disk_counters:
            disk_read_bytes  = _safe_int(dc.read_bytes  - _prev_disk_counters.read_bytes)
            disk_write_bytes = _safe_int(dc.write_bytes - _prev_disk_counters.write_bytes)
        _prev_disk_counters = dc
    except Exception:
        pass

    # Network I/O deltas
    net_sent = net_recv = None
    try:
        nc = psutil.net_io_counters()
        if nc and _prev_net_counters:
            net_sent = _safe_int(nc.bytes_sent - _prev_net_counters.bytes_sent)
            net_recv = _safe_int(nc.bytes_recv - _prev_net_counters.bytes_recv)
        _prev_net_counters = nc
    except Exception:
        pass

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
        ["pid", "name", "cpu_percent", "memory_percent", "memory_info"]
    ):
        try:
            info = proc.info
            pid  = info["pid"]
            name = info.get("name") or "unknown"

            cpu_pct = _safe_float(info.get("cpu_percent"))
            mem_pct = _safe_float(info.get("memory_percent"))
            mem_bytes = None
            if info.get("memory_info"):
                mem_bytes = _safe_int(info["memory_info"].rss)
            threads = None

            # Per-process I/O (not available on Windows without admin)
            io_read = io_write = None
            try:
                pio = proc.io_counters()
                prev = _prev_proc_io.get(pid)
                if prev:
                    io_read  = _safe_int(pio.read_bytes  - prev[0])
                    io_write = _safe_int(pio.write_bytes - prev[1])
                new_prev[pid] = (pio.read_bytes, pio.write_bytes)
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
    conn = get_connection()
    conn.executemany("""
        INSERT INTO process_snapshot
            (timestamp, pid, name, cpu_percent, memory_percent,
             memory_bytes, threads, io_read_bytes, io_write_bytes, is_demo)
        VALUES
            (:timestamp,:pid,:name,:cpu_percent,:memory_percent,
             :memory_bytes,:threads,:io_read_bytes,:io_write_bytes,:is_demo)
    """, snapshots)
    conn.commit()


# ── Background thread ──────────────────────────────────────────────────────────

def _collection_loop():
    global _last_collection_time, _collector_running
    from app.services.pipeline import run_analysis_pipeline

    # Prime psutil counters (first call always returns 0)
    psutil.cpu_percent(interval=None)
    psutil.cpu_times_percent(interval=None)
    time.sleep(0.5)

    _collector_running = True
    logger.info("[Collector] Started")

    while not _stop_event.is_set():
        try:
            interval = float(get_setting("sampling_interval", "3"))

            # 1. Collect
            sys_metric = collect_system_metrics()
            proc_snaps  = collect_process_snapshots()

            # 2. Store
            store_system_metric(sys_metric)
            store_process_snapshots(proc_snaps)
            _last_collection_time = sys_metric["timestamp"]

            # 3. Run analysis pipeline
            try:
                run_analysis_pipeline(sys_metric, proc_snaps)
            except Exception as e:
                logger.warning(f"[Pipeline] Error: {e}")

        except Exception as e:
            logger.error(f"[Collector] Unexpected error: {e}")

        _stop_event.wait(interval)

    _collector_running = False
    logger.info("[Collector] Stopped")


def start_collector():
    global _collector_thread, _stop_event
    _stop_event.clear()
    _collector_thread = threading.Thread(target=_collection_loop, daemon=True, name="systemos-collector")
    _collector_thread.start()


def stop_collector():
    _stop_event.set()
    if _collector_thread:
        _collector_thread.join(timeout=10)


def get_collector_status() -> dict:
    return {
        "running": _collector_running,
        "last_collection_time": _last_collection_time,
    }
