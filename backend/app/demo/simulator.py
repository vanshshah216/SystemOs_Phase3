"""
demo/simulator.py – Synthetic telemetry generator for Demo Mode.

Generates realistic fake metrics that go through the REAL analysis pipeline,
so the statistical engine, anomaly detector, and diagnosis rules are all
exercised with synthetic data.

Scenarios:
  cpu_stress          – CPU spikes to 85-95% (Rule A: Sustained CPU contention)
  memory_pressure     – RAM climbs from ~65% to ~90% with concurrent disk activity (Rule B: Memory pressure with increased disk activity)
  disk_io             – Disk read/write spikes 400x (Rule C: Sustained storage I/O activity)
  network_load        – Network bytes spike 1000x (Rule D: Sustained network-heavy workload)
  process_memory_growth – Synthetic process memory trend (Rule E observation thresholds still apply)
"""

import time
import json
import threading
import random
import logging
from typing import Optional

from app.collector.telemetry import store_system_metric, store_process_snapshots
from app.services.pipeline   import run_analysis_pipeline
from app.database            import get_connection

logger = logging.getLogger("systemos.demo")

# ── Simulated process roster ───────────────────────────────────────────────────
# Clearly designated as simulated synthetic entities to avoid confusing with host OS processes
FAKE_PROCESSES = [
    {"pid": 9001, "name": "Chrome [Simulated]",       "base_cpu": 5,  "base_mem_mb": 800},
    {"pid": 9002, "name": "WorkerThread [Simulated]",  "base_cpu": 3,  "base_mem_mb": 400},
    {"pid": 9003, "name": "PythonTask [Simulated]",    "base_cpu": 1,  "base_mem_mb": 150},
    {"pid": 9004, "name": "DatabaseIO [Simulated]",    "base_cpu": 2,  "base_mem_mb": 300},
]

# Active simulation state
_active_sim: Optional[str] = None
_sim_thread: Optional[threading.Thread] = None
_stop_sim = threading.Event()
_sim_lock = threading.Lock()

# Observable state dictionary
_sim_state = {
    "simulation_id": None,
    "scenario": None,
    "running": False,
    "current_mode": "Normal",
    "samples_injected": 0,
    "current_stage": "Completed", # "Generating Data", "Analyzing", "Checking Persistence", "Diagnosing", "Completed"
    "detection_status": "Not Detected", # "Not Detected", "Potential Anomaly", "Sustained Anomaly", "Diagnosis Generated"
    "diagnosis": None,
    "severity": None,
    "start_time": None,
    "end_time": None,
}


def _update_run_db(status: str = "running"):
    try:
        conn = get_connection()
        conn.execute("""
            INSERT OR REPLACE INTO simulation_run
                (simulation_id, scenario, start_time, end_time, samples_generated,
                 detection_stage, diagnosis, severity, evidence, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            _sim_state["simulation_id"],
            _sim_state["scenario"] or "unknown",
            _sim_state["start_time"] or time.time(),
            _sim_state["end_time"],
            _sim_state["samples_injected"],
            _sim_state["current_stage"],
            _sim_state["diagnosis"],
            _sim_state["severity"],
            json.dumps({"stage": _sim_state["current_stage"], "detection": _sim_state["detection_status"]}),
            status,
        ))
        conn.commit()
    except Exception as e:
        logger.warning(f"[Demo] Could not log simulation run to DB: {e}")


def _jitter(base: float, pct: float = 0.05) -> float:
    return base + base * random.uniform(-pct, pct)


def _build_sys_metric(
    cpu: float, ram: float,
    disk_read: int = 0, disk_write: int = 0,
    net_recv: int = 0, net_sent: int = 0,
) -> dict:
    return {
        "timestamp":          time.time(),
        "cpu_percent":        round(_jitter(cpu, 0.03), 1),
        "cpu_user":           round(cpu * 0.7, 1),
        "cpu_system":         round(cpu * 0.2, 1),
        "cpu_iowait":         None,
        "ram_used":           int(_jitter(ram / 100 * 16 * 1024**3, 0.02)),
        "ram_available":      int((1 - ram / 100) * 16 * 1024**3),
        "ram_percent":        round(_jitter(ram, 0.02), 1),
        "disk_read_bytes":    disk_read,
        "disk_write_bytes":   disk_write,
        "network_sent_bytes": net_sent,
        "network_recv_bytes": net_recv,
        "is_demo":            1,
    }


def _build_proc_snaps(scenario: str, step: int) -> list[dict]:
    snaps = []
    now = time.time()

    for proc in FAKE_PROCESSES:
        pid  = proc["pid"]
        name = proc["name"]
        base_cpu = proc["base_cpu"]
        base_mem = proc["base_mem_mb"] * 1024 * 1024

        cpu_pct = _jitter(base_cpu, 0.10)
        mem_bytes = base_mem

        # Scenario-specific boosting
        if scenario == "cpu_stress" and "Chrome" in name:
            cpu_pct = _jitter(65 + step * 0.5, 0.05)
        elif scenario == "memory_pressure" and "Chrome" in name:
            mem_bytes = base_mem + step * 25 * 1024 * 1024
        elif scenario == "process_memory_growth" and "Chrome" in name:
            mem_bytes = base_mem + step * 50 * 1024 * 1024

        mem_pct = (mem_bytes / (16 * 1024**3)) * 100

        snaps.append({
            "timestamp":      now,
            "pid":            pid,
            "name":           name,
            "cpu_percent":    round(cpu_pct, 1),
            "memory_percent": round(mem_pct, 3),
            "memory_bytes":   int(mem_bytes),
            "threads":        random.randint(5, 30),
            "io_read_bytes":  random.randint(20000, 80000) if scenario == "disk_io" and "DatabaseIO" in name else None,
            "io_write_bytes": random.randint(10000, 40000) if scenario == "disk_io" and "DatabaseIO" in name else None,
            "is_demo":        1,
        })

    return snaps


def _baseline_samples(n: int = 35):
    """Inject n samples of normal-looking data to build a baseline quickly."""
    logger.info(f"[Demo] Injecting {n} baseline samples...")
    _sim_state["current_stage"] = "Generating Data"
    _sim_state["detection_status"] = "Not Detected"

    for i in range(n):
        if _stop_sim.is_set():
            break
        m = _build_sys_metric(cpu=25, ram=55, disk_read=200_000, disk_write=100_000,
                               net_recv=50_000, net_sent=20_000)
        p = _build_proc_snaps("baseline", 0)
        store_system_metric(m)
        store_process_snapshots(p)
        run_analysis_pipeline(m, p, is_demo=True)
        _sim_state["samples_injected"] += 1
        time.sleep(0.04)

    logger.info("[Demo] Baseline established")


# ── Scenario runners ───────────────────────────────────────────────────────────

def _run_cpu_stress():
    _baseline_samples(35)
    step = 0
    _sim_state["diagnosis"] = "Sustained CPU contention"
    _sim_state["severity"] = "HIGH"

    while not _stop_sim.is_set():
        cpu = min(35 + step * 3.5, 94)
        m = _build_sys_metric(cpu=cpu, ram=58, disk_read=300_000, disk_write=150_000)
        p = _build_proc_snaps("cpu_stress", step)
        store_system_metric(m)
        store_process_snapshots(p)
        run_analysis_pipeline(m, p, is_demo=True)
        _sim_state["samples_injected"] += 1

        # Stage progression
        if step == 0:
            _sim_state["current_stage"] = "Analyzing"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step < 4:
            _sim_state["current_stage"] = "Checking Persistence"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step == 4:
            _sim_state["current_stage"] = "Diagnosing"
            _sim_state["detection_status"] = "Sustained Anomaly"
        else:
            _sim_state["current_stage"] = "Completed"
            _sim_state["detection_status"] = "Diagnosis Generated"

        _update_run_db("active")
        step = min(step + 1, 25)
        time.sleep(2.5)


def _run_memory_pressure():
    _baseline_samples(35)
    step = 0
    _sim_state["diagnosis"] = "Memory pressure with increased disk activity"
    _sim_state["severity"] = "HIGH"

    while not _stop_sim.is_set():
        ram = min(58 + step * 2.5, 93)
        disk_r = 1_500_000 + step * 100_000 if ram > 75 else 250_000
        m = _build_sys_metric(cpu=30, ram=ram, disk_read=disk_r, disk_write=300_000)
        p = _build_proc_snaps("memory_pressure", step)
        store_system_metric(m)
        store_process_snapshots(p)
        run_analysis_pipeline(m, p, is_demo=True)
        _sim_state["samples_injected"] += 1

        if step == 0:
            _sim_state["current_stage"] = "Analyzing"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step < 4:
            _sim_state["current_stage"] = "Checking Persistence"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step == 4:
            _sim_state["current_stage"] = "Diagnosing"
            _sim_state["detection_status"] = "Sustained Anomaly"
        else:
            _sim_state["current_stage"] = "Completed"
            _sim_state["detection_status"] = "Diagnosis Generated"

        _update_run_db("active")
        step = min(step + 1, 22)
        time.sleep(2.5)


def _run_disk_io():
    _baseline_samples(35)
    step = 0
    _sim_state["diagnosis"] = "Sustained storage I/O activity"
    _sim_state["severity"] = "MEDIUM"

    while not _stop_sim.is_set():
        dr = min(300_000 + step * 3_500_000, 85_000_000)
        dw = min(150_000 + step * 1_500_000, 40_000_000)
        m = _build_sys_metric(cpu=25, ram=58, disk_read=dr, disk_write=dw)
        p = _build_proc_snaps("disk_io", step)
        store_system_metric(m)
        store_process_snapshots(p)
        run_analysis_pipeline(m, p, is_demo=True)
        _sim_state["samples_injected"] += 1

        if step == 0:
            _sim_state["current_stage"] = "Analyzing"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step < 4:
            _sim_state["current_stage"] = "Checking Persistence"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step == 4:
            _sim_state["current_stage"] = "Diagnosing"
            _sim_state["detection_status"] = "Sustained Anomaly"
        else:
            _sim_state["current_stage"] = "Completed"
            _sim_state["detection_status"] = "Diagnosis Generated"

        _update_run_db("active")
        step = min(step + 1, 28)
        time.sleep(2.5)


def _run_network_load():
    _baseline_samples(35)
    step = 0
    _sim_state["diagnosis"] = "Sustained network-heavy workload"
    _sim_state["severity"] = "LOW"

    while not _stop_sim.is_set():
        nr = min(100_000 + step * 1_500_000, 60_000_000)
        ns = min(50_000 + step * 800_000,   30_000_000)
        m = _build_sys_metric(cpu=22, ram=56, net_recv=nr, net_sent=ns)
        p = _build_proc_snaps("network_load", step)
        store_system_metric(m)
        store_process_snapshots(p)
        run_analysis_pipeline(m, p, is_demo=True)
        _sim_state["samples_injected"] += 1

        if step == 0:
            _sim_state["current_stage"] = "Analyzing"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step < 4:
            _sim_state["current_stage"] = "Checking Persistence"
            _sim_state["detection_status"] = "Potential Anomaly"
        elif step == 4:
            _sim_state["current_stage"] = "Diagnosing"
            _sim_state["detection_status"] = "Sustained Anomaly"
        else:
            _sim_state["current_stage"] = "Completed"
            _sim_state["detection_status"] = "Diagnosis Generated"

        _update_run_db("active")
def _run_process_memory_growth():
    _baseline_samples(35)
    step = 0
    _sim_state["diagnosis"] = "Gradual memory increase observed for Google Chrome [Simulated]"
    _sim_state["severity"] = "LOW"

    while not _stop_sim.is_set():
        # System RAM gradually creeps up, with Chrome memory growing steadily
        ram = min(50 + step * 1.1, 86)
        m = _build_sys_metric(cpu=20, ram=ram)
        p = _build_proc_snaps("process_memory_growth", step)
        store_system_metric(m)
        store_process_snapshots(p)
        run_analysis_pipeline(m, p, is_demo=True)
        _sim_state["samples_injected"] += 1

        if step == 0:
            _sim_state["current_stage"] = "Analyzing"
            _sim_state["detection_status"] = "Baseline Established"
        elif step < 10:
            _sim_state["current_stage"] = "Tracking Trend"
            _sim_state["detection_status"] = "Tracking Memory Trend"
        elif step < 20:
            _sim_state["current_stage"] = "Checking Persistence"
            _sim_state["detection_status"] = "Persistent Memory Growth"
        else:
            _sim_state["current_stage"] = "Completed"
            _sim_state["detection_status"] = "Synthetic trend complete; observation thresholds may not be met"

        _update_run_db("active")
        step = min(step + 1, 35)
        time.sleep(2.0)


_SCENARIOS = {
    "cpu_stress":            _run_cpu_stress,
    "memory_pressure":       _run_memory_pressure,
    "disk_io":               _run_disk_io,
    "network_load":          _run_network_load,
    "process_memory_growth": _run_process_memory_growth,
}



# ── Public API ─────────────────────────────────────────────────────────────────

def start_simulation(scenario: str) -> dict:
    global _active_sim, _sim_thread, _stop_sim

    if scenario not in _SCENARIOS:
        return {"error": f"Unknown scenario: {scenario}"}

    with _sim_lock:
        if _sim_thread and _sim_thread.is_alive():
            _stop_sim.set()
            _sim_thread.join(timeout=8)

        sim_id = f"sim_{int(time.time())}_{scenario}"
        _stop_sim.clear()
        _active_sim = scenario

        _sim_state.update({
            "simulation_id": sim_id,
            "scenario": scenario,
            "running": True,
            "current_mode": "Simulation",
            "samples_injected": 0,
            "current_stage": "Generating Data",
            "detection_status": "Not Detected",
            "diagnosis": None,
            "severity": None,
            "start_time": time.time(),
            "end_time": None,
        })
        _update_run_db("started")

        fn = _SCENARIOS[scenario]
        _sim_thread = threading.Thread(target=fn, daemon=True, name=f"demo-{scenario}")
        _sim_thread.start()

    logger.info(f"[Demo] Started scenario: {scenario} (ID: {sim_id})")
    return {"status": "started", "scenario": scenario, "simulation_id": sim_id}


def stop_simulation() -> dict:
    global _active_sim
    _stop_sim.set()
    _active_sim = None
    _sim_state["running"] = False
    _sim_state["current_mode"] = "Normal"
    _sim_state["end_time"] = time.time()
    _update_run_db("completed")
    return {"status": "stopped"}


def get_simulation_status() -> dict:
    is_alive = _sim_thread.is_alive() if _sim_thread else False
    if not is_alive and _sim_state["running"]:
        _sim_state["running"] = False
        _sim_state["current_mode"] = "Normal"
        _sim_state["end_time"] = time.time()
        _update_run_db("completed")

    return {
        "active_scenario": _active_sim,
        "running": is_alive,
        **_sim_state
    }


def get_simulation_runs(limit: int = 15) -> list[dict]:
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT simulation_id, scenario, start_time, end_time, samples_generated,
                   detection_stage, diagnosis, severity, evidence, status
            FROM simulation_run
            ORDER BY start_time DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"[Demo] Error querying simulation runs: {e}")
        return []
