"""
diagnosis/process_analyzer.py – Explainable, Rule-Based Process Activity Classification
and Recommendation Engine for SYSTEMOS.

Strictly adheres to SYSTEMOS's transparent, explainable architecture:
  - NO machine learning black-boxes; NO automatic process termination.
  - Evaluates 6 deterministic process classifications:
      1. Active application
      2. High resource consumer
      3. Background process
      4. Protected/system process
      5. Review candidate
      6. Insufficient information
  - Avoids false assumptions:
      * Low CPU usage alone NEVER classifies a process as unnecessary.
      * Unfamiliar processes are NEVER assumed safe to terminate.
  - Generates comprehensive evidence-based recommendations explaining:
      * What the process is doing
      * Which resources it consumes
      * Whether usage is unusual
      * Why it was classified this way
      * Whether the user should investigate it
      * Whether normal manual application closure could be considered
      * Any uncertainty or safety concerns
"""

import time
import math
import logging
from typing import Optional, Any
from dataclasses import dataclass, field, asdict

import psutil

from app.database import get_connection
from app.statistics.engine import compute_trend_slope, compute_mean

logger = logging.getLogger("systemos.process_analyzer")

_CPU_COUNT = max(psutil.cpu_count(logical=True) or 1, 1)

# ── 6 Canonical Classifications ────────────────────────────────────────────────
CLASS_ACTIVE_APP        = "Active application"
CLASS_HIGH_RESOURCE     = "High resource consumer"
CLASS_BACKGROUND_PROC   = "Background process"
CLASS_PROTECTED_SYSTEM  = "Protected/system process"
CLASS_REVIEW_CANDIDATE  = "Review candidate"
CLASS_INSUFFICIENT_INFO = "Insufficient information"

CATEGORY_KEYS = {
    CLASS_ACTIVE_APP:        "active_application",
    CLASS_HIGH_RESOURCE:     "high_resource_consumer",
    CLASS_BACKGROUND_PROC:   "background_process",
    CLASS_PROTECTED_SYSTEM:  "protected_system_process",
    CLASS_REVIEW_CANDIDATE:  "review_candidate",
    CLASS_INSUFFICIENT_INFO: "insufficient_information",
}

# ── Operating System Metadata & Curated Process Sets ───────────────────────────

# Known Windows protected OS core processes
SYSTEM_CORE_NAMES = {
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "services.exe", "lsass.exe", "svchost.exe", "fontdrvhost.exe",
    "dwm.exe", "spoolsv.exe", "explorer.exe", "sihost.exe", "taskhostw.exe",
    "runtimebroker.exe", "searchindexer.exe", "audiodg.exe", "securityhealthservice.exe",
    "antimalware service executable", "msmpeng.exe", "werfault.exe", "ctfmon.exe",
    "conhost.exe", "winlogon.exe", "shellexperiencehost.exe", "startmenuexperiencehost.exe",
    "textinputhost.exe", "searchhost.exe", "wlanext.exe", "dashost.exe", "lsaiso.exe",
    "secure system", "memory compression",
}

# Known developer utilities, compilers, local databases, and dev environments
DEVELOPER_SERVICE_NAMES = {
    "python.exe", "pythonw.exe", "node.exe", "code.exe", "git.exe", "docker.exe",
    "dockerd.exe", "postgres.exe", "mysqld.exe", "redis-server.exe", "mongod.exe",
    "java.exe", "javaw.exe", "powershell.exe", "cmd.exe", "uvicorn.exe", "cargo.exe",
    "rustc.exe", "go.exe", "dotnet.exe", "wsl.exe", "wslhost.exe", "bash.exe",
    "ollama.exe", "vmmem",
}

# Known user-facing desktop applications (browsers, media, communications, gaming)
COMMON_USER_APPS = {
    "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe",
    "spotify.exe", "discord.exe", "slack.exe", "teams.exe", "steam.exe",
    "epicgameslauncher.exe", "notion.exe", "obs64.exe", "vlc.exe", "telegram.exe",
    "whatsapp.exe", "thunderbird.exe",
}

# Substring patterns for auxiliary background helpers, updaters, and telemetry
HELPER_PATTERNS = [
    "update", "updater", "helper", "crash", "telemetry", "reporter",
    "cef", "broker", "tray", "notification", "overlay", "assistant",
]

# In-memory cache for process parentage and creation time (pid -> (ppid, create_time, parent_name))
_PROC_META_CACHE: dict[int, tuple[Optional[int], float, Optional[str]]] = {}
_PARENT_NAME_CACHE: dict[int, str] = {}
_TREND_CACHE: dict[int, tuple[float, dict]] = {}
_ANALYZER_CACHE: dict[str, Any] = {
    "timestamp": 0.0,
    "profiles": [],
    "summary": {},
    "recommendations": [],
    "categories_breakdown": {},
}


def get_foreground_process_info() -> tuple[Optional[int], Optional[str]]:
    """
    Query Windows user32.GetForegroundWindow to find the active foreground PID and window title.
    Returns (foreground_pid, window_title). Gracefully returns (None, None) on non-Windows or error.
    """
    try:
        import ctypes
        user32 = getattr(ctypes.windll, "user32", None)
        if not user32:
            return None, None
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return None, None
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        length = user32.GetWindowTextLengthW(hwnd)
        title = None
        if length > 0:
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
        return pid.value, title
    except Exception:
        return None, None


def _get_parent_info(pid: int, create_time: float, proc: Optional[psutil.Process] = None) -> tuple[Optional[int], Optional[str]]:
    """
    Return (ppid, parent_name) with in-memory caching to avoid repeated Win32 RPCs.
    Validates create_time to guarantee cache invalidation upon PID reuse.
    """
    cached = _PROC_META_CACHE.get(pid)
    if cached and abs(cached[1] - create_time) < 1.0:
        return cached[0], cached[2]

    ppid: Optional[int] = None
    parent_name: Optional[str] = None
    try:
        p = proc if proc is not None else psutil.Process(pid)
        ppid = p.ppid()
        if ppid:
            if ppid in _PARENT_NAME_CACHE:
                parent_name = _PARENT_NAME_CACHE[ppid]
            else:
                try:
                    parent_proc = psutil.Process(ppid)
                    parent_name = parent_proc.name()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    parent_name = f"PID {ppid}"
                _PARENT_NAME_CACHE[ppid] = parent_name
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

    _PROC_META_CACHE[pid] = (ppid, create_time, parent_name)
    return ppid, parent_name


def get_system_network_connections_map() -> dict[int, dict[str, int]]:
    """
    Enumerate active network connections across all processes in a single
    efficient system-wide call (~15-20ms).
    Returns mapping: pid -> {'total': int, 'established': int, 'listen': int}
    """
    conn_map: dict[int, dict[str, int]] = {}
    try:
        conns = psutil.net_connections(kind="inet")
        for c in conns:
            pid = c.pid
            if not pid:
                continue
            if pid not in conn_map:
                conn_map[pid] = {"total": 0, "established": 0, "listen": 0}
            conn_map[pid]["total"] += 1
            status = getattr(c, "status", "")
            if status == "ESTABLISHED":
                conn_map[pid]["established"] += 1
            elif status == "LISTEN":
                conn_map[pid]["listen"] += 1
    except (psutil.AccessDenied, Exception) as e:
        logger.debug(f"[Analyzer] net_connections enumeration skipped: {e}")
    return conn_map


def get_active_attribution_map() -> dict[str, list[dict]]:
    """
    Fetch currently active diagnosis events from SQLite diagnosis_event table
    and map primary process names to active anomaly events.
    Returns mapping: process_name_lower -> list of event info dicts
    """
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT id, severity, probable_cause, primary_process, start_time, status, evidence_json
            FROM diagnosis_event
            WHERE status = 'active'
            ORDER BY start_time DESC
        """).fetchall()
        attr_map: dict[str, list[dict]] = {}
        for r in rows:
            proc = (r["primary_process"] or "").lower().strip()
            if proc:
                if proc not in attr_map:
                    attr_map[proc] = []
                attr_map[proc].append({
                    "id": r["id"],
                    "severity": r["severity"],
                    "probable_cause": r["probable_cause"],
                    "start_time": r["start_time"],
                })
        return attr_map
    except Exception as e:
        logger.debug(f"[Analyzer] get_active_attribution_map error: {e}")
        return {}


def get_safety_tier(name: str, pid: int, is_system: bool = False) -> str:
    """
    Determine safety level for user review / potential manual closure:
      - 'protected_system': Core OS kernel or Windows service. MUST NOT be closed.
      - 'review_with_caution': Developer tools, background services, daemons, databases.
      - 'safe_to_review': User-installed desktop applications, web browsers, media tools.
      - 'uncertain': Unfamiliar process with incomplete telemetry. NEVER assume safe to terminate.
    """
    name_lower = (name or "").lower()

    if pid <= 4 or name_lower in SYSTEM_CORE_NAMES or is_system:
        return "protected_system"

    if name_lower in DEVELOPER_SERVICE_NAMES:
        return "review_with_caution"

    if name_lower.endswith("service.exe") or name_lower.endswith("daemon.exe"):
        return "review_with_caution"

    if name_lower in COMMON_USER_APPS:
        return "safe_to_review"

    # For unfamiliar binaries, do NOT assume safe to terminate
    return "review_with_caution"


def classify_activity(
    name: str,
    pid: int,
    cpu_percent: float,
    memory_mb: float,
    status: str = "running",
    io_read_rate: float = 0.0,
    io_write_rate: float = 0.0,
    open_connections: int = 0,
    runtime_seconds: float = 0.0,
    sample_count: int = 0,
    is_accessible: bool = True,
    is_foreground: bool = False,
    parent_name: Optional[str] = None,
    ppid: Optional[int] = None,
    memory_slope_mb: float = 0.0,
    net_growth_mb: float = 0.0,
    has_active_anomaly: bool = False,
) -> str:
    """
    Deterministic, explainable rule engine that classifies a process into
    exactly one of the 6 canonical categories:

      1. Protected/system process
      2. Insufficient information
      3. High resource consumer
      4. Review candidate
      5. Active application
      6. Background process

    Rules obey explicit constraints:
      - Protected system processes are ALWAYS protected.
      - Low CPU alone NEVER triggers Review candidate.
      - Unfamiliar processes are NEVER assumed safe to close.
    """
    name_lower = (name or "").lower()
    total_io_rate = (io_read_rate or 0.0) + (io_write_rate or 0.0)

    # ── Category 1: Protected/System Process ──
    # OS kernel, essential Windows subsystem, or protected service
    if (
        pid <= 4
        or name_lower in SYSTEM_CORE_NAMES
        or name_lower.startswith("system")
        or name_lower == "registry"
        or (parent_name and parent_name.lower() in ("smss.exe", "wininit.exe", "services.exe"))
    ):
        return CLASS_PROTECTED_SYSTEM

    # ── Category 2: Insufficient Information ──
    # Process is inaccessible (AccessDenied), dead (NoSuchProcess), or brand new transient (<10s, <2 samples)
    if not is_accessible or status in ("inaccessible", "terminated"):
        return CLASS_INSUFFICIENT_INFO

    if 0.0 < runtime_seconds < 10.0 and sample_count < 2:
        return CLASS_INSUFFICIENT_INFO

    # ── Category 3: High Resource Consumer ──
    # Consuming large system resources (CPU >= 15% per core, RAM >= 1.2 GB, or Disk >= 5 MB/s)
    if cpu_percent >= 15.0 or memory_mb >= 1200.0 or total_io_rate >= 5_000_000:
        return CLASS_HIGH_RESOURCE

    # ── Category 4: Review Candidate ──
    # Strict, multi-factor criteria. Low CPU alone NEVER qualifies.

    # Sub-rule 4a: Sustained High-Memory Dormant Application
    # Must be a known user-facing desktop app (browser, media, chat) holding >= 350 MB RAM
    # for >= 5 minutes with 0% compute, not currently in foreground, no active IO.
    is_user_app = name_lower in COMMON_USER_APPS
    if (
        is_user_app
        and memory_mb >= 350.0
        and runtime_seconds >= 300.0
        and cpu_percent < 0.2
        and not is_foreground
        and total_io_rate < 50_000
    ):
        return CLASS_REVIEW_CANDIDATE

    # Sub-rule 4b: Background Sustained CPU Drainer
    # Non-protected background process consuming >= 10.0% CPU continuously without user focus
    if (
        not is_foreground
        and cpu_percent >= 10.0
        and runtime_seconds >= 60.0
        and not (parent_name and parent_name.lower() in DEVELOPER_SERVICE_NAMES and "cargo" in name_lower)
    ):
        return CLASS_REVIEW_CANDIDATE

    # Sub-rule 4c: Redundant Auxiliary Helper / Bloatware
    # Known updater, crash reporter, or helper consuming significant RAM (>= 120 MB) or CPU while idle
    is_helper = any(pat in name_lower for pat in HELPER_PATTERNS)
    if is_helper and (memory_mb >= 120.0 or cpu_percent >= 1.0) and runtime_seconds >= 120.0:
        return CLASS_REVIEW_CANDIDATE

    # Sub-rule 4d: Sustained Memory Accumulation (Rule E memory leak candidate)
    if memory_slope_mb >= 0.5 and net_growth_mb >= 80.0 and sample_count >= 10:
        return CLASS_REVIEW_CANDIDATE

    # ── Category 5: Active Application ──
    # User is currently interacting (foreground window) OR process is actively computing/transferring
    if is_foreground or cpu_percent >= 1.0 or total_io_rate >= 100_000 or (open_connections > 0 and status == "running"):
        return CLASS_ACTIVE_APP

    # ── Category 6: Background Process ──
    # Default for normal background services, daemons, workers operating within baseline boundaries
    return CLASS_BACKGROUND_PROC


def compute_process_trends(
    pid: int,
    current_create_time: Optional[float] = None,
    window_seconds: float = 3600.0,
    max_samples: int = 60,
) -> dict:
    """
    Compute historical CPU and RAM trends for a process from SQLite process_snapshot.
    Accounts for PID reuse by filtering snapshots older than current_create_time.
    Uses in-memory TTL caching (10s) to avoid redundant SQLite queries under high polling.
    """
    now = time.time()
    cached = _TREND_CACHE.get(pid)
    if cached and (now - cached[0]) < 10.0:
        return cached[1]

    conn = get_connection()
    start_ts = now - window_seconds

    # If we know create_time, ensure we never pull snapshots from a previous PID incarnation
    if current_create_time and current_create_time > start_ts:
        start_ts = current_create_time - 2.0

    rows = conn.execute("""
        SELECT timestamp, cpu_percent, memory_bytes
        FROM process_snapshot
        WHERE pid = ? AND timestamp >= ? AND is_demo = 0
        ORDER BY timestamp ASC
        LIMIT ?
    """, (pid, start_ts, max_samples)).fetchall()

    if not rows or len(rows) < 3:
        res = {
            "sample_count": len(rows),
            "cpu_slope": 0.0,
            "cpu_trend": "stable",
            "memory_slope_mb": 0.0,
            "memory_trend": "stable",
            "avg_cpu": 0.0,
            "peak_cpu": 0.0,
            "avg_memory_mb": 0.0,
            "peak_memory_mb": 0.0,
            "growth_mb": 0.0,
            "has_history": False,
        }
        _TREND_CACHE[pid] = (now, res)
        return res

    # Normalize CPU per core
    cpu_vals = [round((r["cpu_percent"] or 0.0) / _CPU_COUNT, 2) for r in rows]
    mem_vals_mb = [round((r["memory_bytes"] or 0) / (1024 * 1024), 2) for r in rows]

    cpu_slope = compute_trend_slope(cpu_vals) or 0.0
    mem_slope_mb = compute_trend_slope(mem_vals_mb) or 0.0

    avg_cpu = round(compute_mean(cpu_vals) or 0.0, 2)
    peak_cpu = round(max(cpu_vals), 2)
    avg_mem = round(compute_mean(mem_vals_mb) or 0.0, 1)
    peak_mem = round(max(mem_vals_mb), 1)
    growth_mb = round(mem_vals_mb[-1] - mem_vals_mb[0], 1)

    cpu_trend = "rising" if cpu_slope > 0.05 else "falling" if cpu_slope < -0.05 else "stable"
    mem_trend = "growing" if mem_slope_mb > 0.3 else "shrinking" if mem_slope_mb < -0.3 else "stable"

    res = {
        "sample_count": len(rows),
        "cpu_slope": round(cpu_slope, 3),
        "cpu_trend": cpu_trend,
        "memory_slope_mb": round(mem_slope_mb, 3),
        "memory_trend": mem_trend,
        "avg_cpu": avg_cpu,
        "peak_cpu": peak_cpu,
        "avg_memory_mb": avg_mem,
        "peak_memory_mb": peak_mem,
        "growth_mb": growth_mb,
        "has_history": True,
    }
    _TREND_CACHE[pid] = (now, res)
    return res


def generate_recommendations(profiles: list[dict]) -> list[dict]:
    """
    Generate evidence-based, transparent recommendations for processes classified
    as Review candidates or High resource consumers.

    Every recommendation strictly provides all 7 required dimensions:
      1. activity_description: What the process is doing
      2. resources_consumed: Which resources it consumes
      3. is_usage_unusual: Whether usage is unusual and why
      4. classification_reason: Why it was classified this way
      5. investigation_advice: Whether the user should investigate it
      6. manual_closure_guidance: Whether normal manual application closure could be considered
      7. safety_and_uncertainty: Any uncertainty or safety concerns
    """
    recommendations = []

    for p in profiles:
        pid = p["pid"]
        name = p["name"]
        name_lower = name.lower()
        activity = p["activity_class"]
        safety = p["safety_tier"]
        mem_mb = p.get("memory_mb", 0.0)
        cpu_pct = p.get("cpu_percent", 0.0)
        runtime_secs = p.get("runtime_seconds") or 0.0
        trends = p.get("trends", {})
        growth_mb = trends.get("growth_mb", 0.0)
        mem_slope = trends.get("memory_slope_mb", 0.0)
        conns = p.get("open_connections", 0)
        parent_name = p.get("parent_name") or "Unknown parent"
        is_fg = p.get("is_foreground", False)
        attributed_events = p.get("attributed_events", [])

        # Protected system processes are NEVER recommended for closure
        if activity == CLASS_PROTECTED_SYSTEM or safety == "protected_system":
            continue

        # Insufficient information processes are not recommended for termination
        if activity == CLASS_INSUFFICIENT_INFO:
            continue

        # RULE REC-0: Attributed to Active System-Level Diagnosis Event
        if attributed_events:
            evt_strs = [f"#{e['id']} ({e['probable_cause']}, {e['severity']})" for e in attributed_events]
            highest_sev = "HIGH" if any(e["severity"] == "HIGH" for e in attributed_events) else "MEDIUM"
            recommendations.append({
                "id": f"rec_{pid}_active_anomaly",
                "pid": pid,
                "name": name,
                "category": "active_anomaly_attribution",
                "classification": activity,
                "severity": highest_sev,
                "safety_tier": safety,
                "reclaimable_memory_mb": round(mem_mb * 0.7, 1) if mem_mb > 400.0 else 0.0,
                "reclaimable_cpu_percent": round(cpu_pct, 1),
                "what_process_is_doing": (
                    f"Process is the identified primary contributor to ongoing system performance anomaly: {', '.join(evt_strs)}."
                ),
                "activity_description": (
                    f"Process is the identified primary contributor to ongoing system performance anomaly: {', '.join(evt_strs)}."
                ),
                "resources_consumed": (
                    f"CPU: {cpu_pct:.1f}% | Memory: {mem_mb:.1f} MB RSS | Sockets: {conns} | Threads: {p.get('threads', 0)}"
                ),
                "is_usage_unusual": (
                    f"Highly unusual: Directly attributed to active system-level performance incident: {evt_strs[0]}."
                ),
                "classification_reason": (
                    f"Classified as '{activity}' and correlated with active root-cause diagnosis event in SYSTEMOS."
                ),
                "should_investigate": "Yes - High Priority: Directly driving active system-wide resource saturation.",
                "investigation_advice": "Yes - High Priority: Review the active diagnosis event in the Diagnostics tab and assess process workload.",
                "manual_closure_considered": (
                    "Normal manual closure can be considered if the application is frozen or its task is finished. "
                    "SYSTEMOS never terminates processes automatically."
                ),
                "manual_closure_guidance": (
                    "Normal manual closure can be considered if the application is frozen or its task is finished. "
                    "SYSTEMOS never terminates processes automatically."
                ),
                "safety_and_uncertainty": (
                    f"Safety: {safety}. Check whether unsaved work or pending data operations exist before closing. "
                    f"Parent process: {parent_name}."
                ),
                "evidence": [
                    f"Attributed to active diagnosis event: {evt_strs[0]}",
                    f"Current CPU consumption: {cpu_pct:.1f}%",
                    f"Current memory footprint: {mem_mb:.1f} MB RSS",
                    f"Parent process: {parent_name}",
                ],
            })
            continue

        # RULE REC-1: High-Resource Idle Application
        if (
            activity == CLASS_REVIEW_CANDIDATE
            and name_lower in COMMON_USER_APPS
            and mem_mb >= 350.0
            and runtime_secs >= 300.0
            and cpu_pct < 0.2
        ):
            sev = "HIGH" if mem_mb >= 1000.0 else "MEDIUM"
            recommendations.append({
                "id": f"rec_{pid}_idle_memory",
                "pid": pid,
                "name": name,
                "category": "idle_high_memory",
                "classification": CLASS_REVIEW_CANDIDATE,
                "severity": sev,
                "safety_tier": safety,
                "reclaimable_memory_mb": round(mem_mb * 0.85, 1),
                "reclaimable_cpu_percent": 0.0,
                "activity_description": (
                    f"Dormant user-level desktop application holding {mem_mb:.1f} MB RAM without active processing."
                ),
                "resources_consumed": (
                    f"Memory: {mem_mb:.1f} MB RSS | CPU: {cpu_pct:.1f}% | Sockets: {conns} | Threads: {p.get('threads', 0)}"
                ),
                "is_usage_unusual": (
                    f"Unusual: The application has been idle for {int(runtime_secs // 60)} minutes but retains "
                    f"a large memory buffer ({mem_mb:.1f} MB) in resident RAM."
                ),
                "classification_reason": (
                    f"Classified as '{CLASS_REVIEW_CANDIDATE}' because it is a known user application with significant "
                    f"memory allocation (>=350MB) sitting completely idle without foreground interaction."
                ),
                "investigation_advice": (
                    "Yes, investigate. Check if background tabs, heavy web documents, or minimized windows are no longer needed."
                ),
                "manual_closure_guidance": (
                    "Normal manual closure can be considered through the application's interface (File -> Exit, closing windows, "
                    "or closing browser tabs). SYSTEMOS never terminates processes automatically."
                ),
                "safety_and_uncertainty": (
                    f"Safety: Safe to review. This is an application-level executable ({name}). Closing it manually will not "
                    "affect core Windows OS stability. Save any open unsaved work before closing."
                ),
                "evidence": [
                    f"Process memory footprint: {mem_mb:.1f} MB (RSS)",
                    f"Instant CPU activity: {cpu_pct:.1f}% (idle state)",
                    f"Process duration: {int(runtime_secs // 60)} minutes without active foreground compute",
                    f"Parent process: {parent_name}",
                ],
            })
            continue

        # RULE REC-2: Background CPU Drainer
        if (
            activity in (CLASS_REVIEW_CANDIDATE, CLASS_HIGH_RESOURCE)
            and cpu_pct >= 10.0
            and not is_fg
        ):
            sev = "HIGH" if cpu_pct >= 25.0 else "MEDIUM"
            recommendations.append({
                "id": f"rec_{pid}_cpu_drain",
                "pid": pid,
                "name": name,
                "category": "background_cpu_drain",
                "classification": activity,
                "severity": sev,
                "safety_tier": safety,
                "reclaimable_memory_mb": round(mem_mb * 0.5, 1),
                "reclaimable_cpu_percent": round(cpu_pct, 1),
                "activity_description": (
                    f"Background process consuming continuous, elevated compute cycles ({cpu_pct:.1f}% per-core) without foreground user focus."
                ),
                "resources_consumed": (
                    f"CPU: {cpu_pct:.1f}% (per-core) | Memory: {mem_mb:.1f} MB | Sockets: {conns} | Threads: {p.get('threads', 0)}"
                ),
                "is_usage_unusual": (
                    f"Unusual: Process is driving sustained compute ({cpu_pct:.1f}%) while running entirely in the background."
                ),
                "classification_reason": (
                    f"Classified as '{activity}' due to continuous high CPU consumption (>=10%) during background execution."
                ),
                "investigation_advice": (
                    "Yes, investigate. Inspect what background task, script, or calculation the process is running."
                ),
                "manual_closure_guidance": (
                    "If the application is frozen, looping indefinitely, or its task is finished, graceful manual closure or "
                    "restart may be considered. Verify ongoing data operations before closing."
                ),
                "safety_and_uncertainty": (
                    f"Safety: {safety}. Check whether this process was spawned by your development tools or build pipeline "
                    f"before interrupting. Parent process is {parent_name}."
                ),
                "evidence": [
                    f"Sustained CPU usage: {cpu_pct:.1f}% (per-core normalized)",
                    f"CPU trend: {trends.get('cpu_trend', 'stable')} (slope: {trends.get('cpu_slope', 0.0):+.2f})",
                    f"Foreground state: Inactive / Background window",
                    f"Parent process: {parent_name}",
                ],
            })
            continue

        # RULE REC-3: Redundant Background Helper / Bloatware
        is_helper = any(pat in name_lower for pat in HELPER_PATTERNS)
        if is_helper and (mem_mb >= 120.0 or cpu_pct >= 1.0) and activity == CLASS_REVIEW_CANDIDATE:
            recommendations.append({
                "id": f"rec_{pid}_redundant_helper",
                "pid": pid,
                "name": name,
                "category": "redundant_helper",
                "classification": CLASS_REVIEW_CANDIDATE,
                "severity": "LOW" if mem_mb < 300.0 else "MEDIUM",
                "safety_tier": "safe_to_review",
                "reclaimable_memory_mb": round(mem_mb * 0.9, 1),
                "reclaimable_cpu_percent": round(cpu_pct, 1),
                "activity_description": (
                    f"Auxiliary helper, updater, or telemetry agent ({name}) running in the background."
                ),
                "resources_consumed": (
                    f"Memory: {mem_mb:.1f} MB | CPU: {cpu_pct:.1f}% | Threads: {p.get('threads', 0)}"
                ),
                "is_usage_unusual": (
                    f"Expected low-footprint helper is holding {mem_mb:.1f} MB RAM while its main application may not be in active use."
                ),
                "classification_reason": (
                    f"Classified as '{CLASS_REVIEW_CANDIDATE}' because it matches known auxiliary helper patterns and occupies >120 MB RAM."
                ),
                "investigation_advice": (
                    "Consider checking if the parent software has settings to disable automatic background helpers or startup launch."
                ),
                "manual_closure_guidance": (
                    "Manual closure via task tray or disabling automatic launch in application settings can be considered."
                ),
                "safety_and_uncertainty": (
                    "Safety: Safe to review. Auxiliary updater/crash reporter utilities can generally be closed without affecting "
                    "main operational functionality."
                ),
                "evidence": [
                    f"Process identity matches auxiliary pattern '{name}'",
                    f"Memory consumption: {mem_mb:.1f} MB resident RAM",
                    f"Status: {p.get('status', 'running')}",
                    f"Parent process: {parent_name}",
                ],
            })
            continue

        # RULE REC-4: Sustained Unusual Memory Growth (Rule E candidate)
        if mem_slope >= 0.5 and growth_mb >= 80.0:
            recommendations.append({
                "id": f"rec_{pid}_memory_growth",
                "pid": pid,
                "name": name,
                "category": "memory_growth",
                "classification": CLASS_REVIEW_CANDIDATE,
                "severity": "HIGH" if mem_mb >= 1000.0 else "MEDIUM",
                "safety_tier": safety,
                "reclaimable_memory_mb": round(growth_mb, 1),
                "reclaimable_cpu_percent": 0.0,
                "activity_description": (
                    f"Process exhibiting monotonic, persistent memory growth ({growth_mb:.1f} MB net increase)."
                ),
                "resources_consumed": (
                    f"Current Memory: {mem_mb:.1f} MB | Slope: +{mem_slope:.2f} MB/sample | CPU: {cpu_pct:.1f}%"
                ),
                "is_usage_unusual": (
                    f"Unusual: Memory footprint has consistently grown by {mem_slope:.2f} MB per sample across {trends.get('sample_count', 0)} samples."
                ),
                "classification_reason": (
                    f"Classified as '{CLASS_REVIEW_CANDIDATE}' due to statistically confirmed sustained memory accumulation (Rule E candidate)."
                ),
                "investigation_advice": (
                    "Yes, investigate. Check if the application has a memory retention issue, cached buffers, or uncollected resources."
                ),
                "manual_closure_guidance": (
                    "Restarting the application normally will flush accumulated memory allocations and restore baseline footprint."
                ),
                "safety_and_uncertainty": (
                    f"Safety: {safety}. Labelled strictly as 'Sustained unusual memory growth' – never declared a confirmed leak without "
                    "internal heap profiling. Save work before restarting."
                ),
                "evidence": [
                    f"Memory growth rate: +{mem_slope:.2f} MB per sample",
                    f"Observed net expansion: +{growth_mb:.1f} MB over {trends.get('sample_count', 0)} samples",
                    f"Current allocation: {mem_mb:.1f} MB RSS",
                    f"Parent process: {parent_name}",
                ],
            })

    # Sort recommendations by severity (HIGH -> MEDIUM -> LOW) and reclaimable memory
    sev_weight = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
    recommendations.sort(
        key=lambda r: (sev_weight.get(r["severity"], 0), r["reclaimable_memory_mb"]),
        reverse=True,
    )
    return recommendations


def inspect_live_process(
    pid: int,
    net_conn_map: Optional[dict] = None,
    fg_info: Optional[tuple[Optional[int], Optional[str]]] = None,
    attr_map: Optional[dict[str, list[dict]]] = None,
) -> Optional[dict]:
    """
    Inspect a single live process with comprehensive telemetry and metadata.
    Safely handles psutil.NoSuchProcess, psutil.AccessDenied, and Windows platform quirks.
    """
    proc = None
    try:
        proc = psutil.Process(pid)
        with proc.oneshot():
            name = proc.name()
            status = proc.status()
            create_time = proc.create_time()
            runtime_seconds = max(round(time.time() - create_time, 1), 0.0)

            # Parent info with cache
            ppid, parent_name = _get_parent_info(pid, create_time, proc=proc)

            # Foreground detection on Windows (use pre-fetched fg_info if provided)
            if fg_info is not None:
                fg_pid, fg_title = fg_info
            else:
                fg_pid, fg_title = get_foreground_process_info()
            is_foreground = (fg_pid is not None and fg_pid == pid)

            # CPU & Memory
            raw_cpu = proc.cpu_percent(interval=None) or 0.0
            norm_cpu = round(raw_cpu / _CPU_COUNT, 1)

            mem_info = proc.memory_info()
            mem_bytes = mem_info.rss
            mem_vms = mem_info.vms
            mem_pct = round(proc.memory_percent() or 0.0, 2)
            mem_mb = round(mem_bytes / (1024 * 1024), 1)

            try:
                threads = proc.num_threads()
            except Exception:
                threads = 0

            # Disk I/O (gracefully handle AccessDenied or unsupported on Windows without admin)
            io_read_bytes = io_write_bytes = None
            try:
                pio = proc.io_counters()
                io_read_bytes = pio.read_bytes
                io_write_bytes = pio.write_bytes
            except (psutil.AccessDenied, AttributeError, NotImplementedError, psutil.NoSuchProcess):
                pass

        # Network connections from pre-calculated map or on-demand
        conns_info = {"total": 0, "established": 0, "listen": 0}
        if net_conn_map is not None:
            conns_info = net_conn_map.get(pid, conns_info)
        else:
            try:
                for c in proc.net_connections(kind="inet"):
                    conns_info["total"] += 1
                    if getattr(c, "status", "") == "ESTABLISHED":
                        conns_info["established"] += 1
                    elif getattr(c, "status", "") == "LISTEN":
                        conns_info["listen"] += 1
            except (psutil.AccessDenied, psutil.NoSuchProcess, Exception):
                pass

        # Historical trends from SQLite (TTL cached)
        trends = compute_process_trends(pid, current_create_time=create_time)

        # Safety Tier
        safety = get_safety_tier(name, pid)

        # Attributed active diagnosis events (if any)
        if attr_map is not None:
            attributed_events = attr_map.get(name.lower(), [])
        else:
            active_attr_map = get_active_attribution_map()
            attributed_events = active_attr_map.get(name.lower(), [])

        # Canonical Activity Classification (1 of 6)
        activity = classify_activity(
            name=name,
            pid=pid,
            cpu_percent=norm_cpu,
            memory_mb=mem_mb,
            status=status,
            io_read_rate=0.0,
            io_write_rate=0.0,
            open_connections=conns_info["total"],
            runtime_seconds=runtime_seconds,
            sample_count=trends.get("sample_count", 0),
            is_accessible=True,
            is_foreground=is_foreground,
            parent_name=parent_name,
            ppid=ppid,
            memory_slope_mb=trends.get("memory_slope_mb", 0.0),
            net_growth_mb=trends.get("growth_mb", 0.0),
            has_active_anomaly=bool(attributed_events),
        )

        return {
            "pid": pid,
            "name": name,
            "ppid": ppid,
            "parent_name": parent_name,
            "status": status,
            "create_time": create_time,
            "runtime_seconds": runtime_seconds,
            "cpu_percent": norm_cpu,
            "cpu_percent_raw": round(raw_cpu, 1),
            "memory_percent": mem_pct,
            "memory_bytes": mem_bytes,
            "memory_vms_bytes": mem_vms,
            "memory_mb": mem_mb,
            "threads": threads,
            "io_read_bytes": io_read_bytes,
            "io_write_bytes": io_write_bytes,
            "open_connections": conns_info["total"],
            "established_connections": conns_info["established"],
            "listening_ports": conns_info["listen"],
            "is_foreground": is_foreground,
            "foreground_window_title": fg_title if is_foreground else None,
            "activity_class": activity,
            "activity_label": activity,
            "activity_key": CATEGORY_KEYS.get(activity, "background_process"),
            "safety_tier": safety,
            "is_system": safety == "protected_system",
            "attributed_events": attributed_events,
            "trends": trends,
            "is_accessible": True,
        }
    except (psutil.NoSuchProcess, psutil.ZombieProcess):
        return None
    except psutil.AccessDenied:
        # Graceful handling of inaccessible processes (classified as protected system or insufficient info)
        proc_name = "Inaccessible Process"
        try:
            if proc is not None:
                proc_name = proc.name() or proc_name
            else:
                proc_name = psutil.Process(pid).name() or proc_name
        except Exception:
            pass

        name_lower = proc_name.lower()
        is_sys = (pid <= 4 or name_lower in SYSTEM_CORE_NAMES or name_lower.startswith("system") or name_lower == "registry")
        act_class = CLASS_PROTECTED_SYSTEM if is_sys else CLASS_INSUFFICIENT_INFO
        safety = "protected_system" if is_sys else "uncertain"

        return {
            "pid": pid,
            "name": proc_name,
            "ppid": None,
            "parent_name": None,
            "status": "inaccessible",
            "create_time": None,
            "runtime_seconds": 0.0,
            "cpu_percent": 0.0,
            "cpu_percent_raw": 0.0,
            "memory_percent": 0.0,
            "memory_bytes": 0,
            "memory_vms_bytes": 0,
            "memory_mb": 0.0,
            "threads": 0,
            "io_read_bytes": None,
            "io_write_bytes": None,
            "open_connections": 0,
            "established_connections": 0,
            "listening_ports": 0,
            "is_foreground": False,
            "foreground_window_title": None,
            "activity_class": act_class,
            "activity_label": act_class,
            "activity_key": CATEGORY_KEYS.get(act_class, "insufficient_information"),
            "safety_tier": safety,
            "is_system": is_sys,
            "attributed_events": [],
            "trends": {"has_history": False},
            "is_accessible": False,
        }


def analyze_processes(
    sort_by: str = "cpu_percent",
    limit: int = 50,
    category: Optional[str] = None,
    safety: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """
    Perform system-wide process analysis across the 6 canonical classifications.
    Uses latest snapshot database state combined with live telemetry and 2.5s TTL caching
    to provide lightning-fast responses without freezing under 1000+ processes.
    """
    now = time.time()
    global _ANALYZER_CACHE

    # Check in-memory cache for recent full analysis (< 3.0s)
    cache_age = now - _ANALYZER_CACHE.get("timestamp", 0.0)
    cached_profiles = _ANALYZER_CACHE.get("profiles", [])

    if cache_age < 3.0 and cached_profiles:
        profiles = list(cached_profiles)
        summary = dict(_ANALYZER_CACHE.get("summary", {}))
        recommendations = list(_ANALYZER_CACHE.get("recommendations", []))
        categories_breakdown = dict(_ANALYZER_CACHE.get("categories_breakdown", {}))
    else:
        conn = get_connection()
        latest = conn.execute(
            "SELECT MAX(timestamp) as ts FROM process_snapshot WHERE is_demo=0"
        ).fetchone()

        net_conn_map = get_system_network_connections_map()
        fg_info = get_foreground_process_info()
        attr_map = get_active_attribution_map()

        # Select candidate PIDs from latest snapshot collection
        candidate_pids: list[int] = []
        if latest and latest["ts"]:
            ts = latest["ts"]
            rows = conn.execute("""
                SELECT pid, cpu_percent, memory_bytes
                FROM process_snapshot
                WHERE timestamp BETWEEN ? AND ? AND is_demo = 0 AND pid > 0
                GROUP BY pid
                HAVING timestamp = MAX(timestamp)
                ORDER BY cpu_percent DESC, memory_bytes DESC
                LIMIT 120
            """, (ts - 6, ts + 1)).fetchall()
            candidate_pids = [r["pid"] for r in rows]

        # Fallback to psutil process enumeration if database has no recent snapshots
        if not candidate_pids:
            try:
                for p in sorted(
                    psutil.process_iter(["pid", "name"]),
                    key=lambda x: x.pid,
                )[:120]:
                    if p.pid > 0:
                        candidate_pids.append(p.pid)
            except Exception:
                pass

        # Inspect each candidate process (include accessible AND inaccessible)
        profiles = []
        for pid in candidate_pids:
            prof = inspect_live_process(pid, net_conn_map=net_conn_map, fg_info=fg_info, attr_map=attr_map)
            if prof:
                profiles.append(prof)

        # Fallback to live psutil enumeration if profiles is still empty
        if not profiles:
            try:
                for p in sorted(
                    psutil.process_iter(["pid", "name"]),
                    key=lambda x: x.pid,
                )[:120]:
                    if p.pid > 0:
                        prof = inspect_live_process(p.pid, net_conn_map=net_conn_map, fg_info=fg_info, attr_map=attr_map)
                        if prof:
                            profiles.append(prof)
            except Exception:
                pass

        # Calculate summary metrics across all 6 canonical categories
        total_tracked_mb = sum(p["memory_mb"] for p in profiles)
        idle_memory_mb = sum(
            p["memory_mb"] for p in profiles if p["activity_class"] in (CLASS_BACKGROUND_PROC, CLASS_REVIEW_CANDIDATE)
        )

        counts_by_class = {
            CLASS_ACTIVE_APP:        sum(1 for p in profiles if p["activity_class"] == CLASS_ACTIVE_APP),
            CLASS_HIGH_RESOURCE:     sum(1 for p in profiles if p["activity_class"] == CLASS_HIGH_RESOURCE),
            CLASS_BACKGROUND_PROC:   sum(1 for p in profiles if p["activity_class"] == CLASS_BACKGROUND_PROC),
            CLASS_PROTECTED_SYSTEM:  sum(1 for p in profiles if p["activity_class"] == CLASS_PROTECTED_SYSTEM),
            CLASS_REVIEW_CANDIDATE:  sum(1 for p in profiles if p["activity_class"] == CLASS_REVIEW_CANDIDATE),
            CLASS_INSUFFICIENT_INFO: sum(1 for p in profiles if p["activity_class"] == CLASS_INSUFFICIENT_INFO),
        }

        # Generate evidence-based recommendations
        recommendations = generate_recommendations(profiles)
        total_reclaimable_mb = sum(r.get("reclaimable_memory_mb", 0.0) for r in recommendations)

        # Build categories breakdown across all 6 classes
        categories_breakdown = {}
        for canonical_class, key in CATEGORY_KEYS.items():
            procs_in_class = [p for p in profiles if p["activity_class"] == canonical_class]
            categories_breakdown[key] = {
                "label": canonical_class,
                "count": len(procs_in_class),
                "memory_mb": round(sum(p["memory_mb"] for p in procs_in_class), 1),
                "avg_cpu": round(compute_mean([p["cpu_percent"] for p in procs_in_class]) or 0.0, 1),
            }

        summary = {
            "total_analyzed": len(profiles),
            "total_system_processes": len(psutil.pids()),
            "active_application_count": counts_by_class[CLASS_ACTIVE_APP],
            "high_resource_consumer_count": counts_by_class[CLASS_HIGH_RESOURCE],
            "background_process_count": counts_by_class[CLASS_BACKGROUND_PROC],
            "protected_system_count": counts_by_class[CLASS_PROTECTED_SYSTEM],
            "review_candidate_count": counts_by_class[CLASS_REVIEW_CANDIDATE],
            "insufficient_information_count": counts_by_class[CLASS_INSUFFICIENT_INFO],
            "total_memory_tracked_mb": round(total_tracked_mb, 1),
            "idle_memory_mb": round(idle_memory_mb, 1),
            "potential_reclaimable_memory_mb": round(total_reclaimable_mb, 1),
            "recommendations_count": len(recommendations),
            "cpu_core_count": _CPU_COUNT,
            "network_metrics_supported": True,
            "network_metrics_description": (
                "Per-process active IPv4/IPv6 socket count (ESTABLISHED, LISTEN) is monitored via "
                "system-wide Win32 enumeration. Per-process network throughput bytes/sec are not "
                "natively exposed by Windows without kernel ETW/WFP packet drivers."
            ),
        }

        # Update cache with write completion time
        _ANALYZER_CACHE = {
            "timestamp": time.time(),
            "profiles": list(profiles),
            "summary": dict(summary),
            "recommendations": list(recommendations),
            "categories_breakdown": dict(categories_breakdown),
        }

    # Filter by category / safety / search if specified
    filtered = list(profiles)
    if category:
        filtered = [
            p for p in filtered
            if p["activity_class"] == category or p["activity_key"] == category
        ]
    if safety:
        filtered = [p for p in filtered if p["safety_tier"] == safety]
    if search:
        q = search.lower().strip()
        filtered = [p for p in filtered if q in p["name"].lower() or q in str(p["pid"])]

    # Sort
    sort_keys = {
        "cpu_percent": lambda x: x["cpu_percent"],
        "memory_bytes": lambda x: x["memory_bytes"],
        "memory_mb": lambda x: x["memory_mb"],
        "runtime_seconds": lambda x: x["runtime_seconds"],
        "open_connections": lambda x: x["open_connections"],
    }
    key_fn = sort_keys.get(sort_by, sort_keys["cpu_percent"])
    filtered.sort(key=key_fn, reverse=True)

    limited = filtered[:limit]

    return {
        "summary": summary,
        "recommendations": recommendations,
        "processes": limited,
        "categories_breakdown": categories_breakdown,
    }
