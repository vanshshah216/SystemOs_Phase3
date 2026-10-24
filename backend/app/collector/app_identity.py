"""
app_identity.py – Windows process → application identity and grouping.

Resolves display names from PE metadata, parent chains, and package paths.
Never invents product names from executable filenames alone.
"""

from __future__ import annotations

import logging
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Optional

import psutil

logger = logging.getLogger("systemos.app_identity")

# Browser / host roots for child process elevation
_BROWSER_ROOTS = {
    "msedge.exe": ("microsoft-edge", "Microsoft Edge"),
    "chrome.exe": ("google-chrome", "Google Chrome"),
    "firefox.exe": ("mozilla-firefox", "Mozilla Firefox"),
    "brave.exe": ("brave-browser", "Brave"),
    "opera.exe": ("opera", "Opera"),
}

_EDGE_HELPERS = {"msedgewebview2.exe", "msedge_proxy.exe"}
_KNOWN_WINDOWS_APPS = {
    "mspaint.exe": ("microsoft-paint", "Microsoft Paint"),
    "winstore.app.exe": ("microsoft-store", "Microsoft Store"),
}
_KNOWN_RUNTIME_PROCESSES = {
    "python.exe": ("python-runtime", "Python"),
    "pythonw.exe": ("python-runtime", "Python"),
    "node.exe": ("node-runtime", "Node.js Runtime"),
}
_KNOWN_APPLICATION_NAMES = {
    **{app_id: display_name for app_id, display_name in _BROWSER_ROOTS.values()},
    **{app_id: display_name for app_id, display_name in _KNOWN_WINDOWS_APPS.values()},
    "visual-studio-code": "Visual Studio Code",
    "systemos-monitor": "SYSTEMOS Monitor",
    "python-runtime": "Python",
    "node-runtime": "Node.js Runtime",
}
_WINDOWS_SERVICE_PROCESSES = {
    "svchost.exe", "services.exe", "dllhost.exe", "lsass.exe", "wininit.exe",
    "csrss.exe", "smss.exe", "winlogon.exe", "dwm.exe", "spoolsv.exe",
}

_GENERIC_PE_DESCRIPTIONS = {
    "",
    "host process",
    "runtime broker",
    "application frame host",
    "windows host process",
    "microsoft edge",
    "chrome",
}

# Cached AppX display names: family_name_lower -> display_name
_appx_display_cache: dict[str, str] | None = None
_appx_cache_time: float = 0.0
_APPX_CACHE_TTL = 600.0
_pe_metadata_cache: dict[str, tuple[int, int, tuple[Optional[str], Optional[str], Optional[str]]]] = {}

# Per-PID identity cache: pid -> (create_time, ProcessIdentity)
_identity_cache: dict[int, tuple[float, "ProcessIdentity"]] = {}


@dataclass
class ProcessIdentity:
    pid: int
    process_name: str
    display_name: str
    display_source: str
    confidence: float
    application_id: str
    role: str  # user_app | background | service | helper | system | monitor_runtime | unknown
    exe_path: Optional[str] = None
    publisher: Optional[str] = None
    package_family: Optional[str] = None
    parent_pid: Optional[int] = None
    parent_process_name: Optional[str] = None
    ppid_chain_root_id: Optional[str] = None
    is_fallback_label: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def recognizable_application_name(
    process_name: Optional[str],
    application_id: Optional[str] = None,
) -> Optional[str]:
    """Return a confident built-in display name for persisted historical records."""
    if application_id in _KNOWN_APPLICATION_NAMES:
        return _KNOWN_APPLICATION_NAMES[application_id]
    normalized_name = (process_name or "").lower()
    if normalized_name in _KNOWN_WINDOWS_APPS:
        return _KNOWN_WINDOWS_APPS[normalized_name][1]
    if normalized_name in _BROWSER_ROOTS:
        return _BROWSER_ROOTS[normalized_name][1]
    if normalized_name in _KNOWN_RUNTIME_PROCESSES:
        return _KNOWN_RUNTIME_PROCESSES[normalized_name][1]
    return None


def _safe_proc_name(proc: psutil.Process) -> str:
    try:
        return proc.name() or "unknown"
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return "unknown"


def _safe_exe_path(proc: psutil.Process) -> Optional[str]:
    try:
        return proc.exe()
    except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
        return None


def _safe_cmdline(proc: psutil.Process) -> list[str]:
    try:
        return proc.cmdline() or []
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return []


def _read_pe_strings(exe_path: Optional[str]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (file_description, product_name, company_name) from PE version resource."""
    if not exe_path:
        return None, None, None
    try:
        normalized_path = os.path.normcase(os.path.abspath(exe_path))
        stat = os.stat(normalized_path)
    except OSError:
        return None, None, None
    cached = _pe_metadata_cache.get(normalized_path)
    if cached and cached[:2] == (stat.st_mtime_ns, stat.st_size):
        return cached[2]

    result: tuple[Optional[str], Optional[str], Optional[str]] = (None, None, None)
    try:
        import pefile  # type: ignore

        pe = pefile.PE(normalized_path, fast_load=True)
        pe.parse_data_directories(
            directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]]
        )
        if not hasattr(pe, "FileInfo") or not pe.FileInfo:
            _pe_metadata_cache[normalized_path] = (stat.st_mtime_ns, stat.st_size, result)
            return result
        desc = prod = company = None
        for file_info in pe.FileInfo:
            for entry in file_info:
                if hasattr(entry, "StringTable"):
                    for st in entry.StringTable:
                        for k, v in st.entries.items():
                            key = k.decode("utf-8", errors="ignore").lower()
                            val = v.decode("utf-8", errors="ignore").strip()
                            if key == "filedescription":
                                desc = val
                            elif key == "productname":
                                prod = val
                            elif key == "companyname":
                                company = val
        result = (desc, prod, company)
    except Exception as e:
        logger.debug("PE read failed for %s: %s", exe_path, e)
    _pe_metadata_cache[normalized_path] = (stat.st_mtime_ns, stat.st_size, result)
    return result


def _load_appx_display_names() -> dict[str, str]:
    global _appx_display_cache, _appx_cache_time
    now = time.time()
    if _appx_display_cache is not None and (now - _appx_cache_time) < _APPX_CACHE_TTL:
        return _appx_display_cache

    mapping: dict[str, str] = {}
    if sys.platform != "win32":
        _appx_display_cache = mapping
        _appx_cache_time = now
        return mapping

    try:
        import subprocess

        ps_cmd = (
            "$names=@{}; Get-StartApps | ForEach-Object { "
            "if ($_.AppID -match '^(.+)!') { $names[$Matches[1].ToLower()]=$_.Name } }; "
            "Get-AppxPackage | ForEach-Object { "
            "$family=$_.PackageFamilyName.ToLower(); "
            "$display=$names[$family]; "
            "if (-not $display) { $display=$_.Name }; "
            "[pscustomobject]@{PackageFamilyName=$family; DisplayName=$display} "
            "} | ConvertTo-Json -Compress"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if result.returncode == 0 and result.stdout.strip():
            import json

            raw = json.loads(result.stdout)
            items = raw if isinstance(raw, list) else [raw]
            for item in items:
                family = (item.get("PackageFamilyName") or "").lower()
                disp = item.get("DisplayName") or item.get("Name") or ""
                if family and disp:
                    mapping[family] = str(disp)
    except Exception as e:
        logger.debug("Appx package enumeration skipped: %s", e)

    _appx_display_cache = mapping
    _appx_cache_time = now
    return mapping


def _package_from_path(exe_path: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Extract package family segment from WindowsApps path and resolve display name."""
    if not exe_path:
        return None, None
    normalized_path = exe_path.replace("/", "\\")
    if "\\windowsapps\\" not in normalized_path.lower():
        return None, None
    # Package family names are <package name>_<publisher id>; the folder also
    # contains version, architecture, and resource-id components.
    folder = normalized_path.split("\\")[-2]
    m = re.match(r"^(.+?)_(\d+(?:\.\d+)*)_[^_]+_[^_]*_([^_]+)$", folder)
    if not m:
        return None, None
    family = f"{m.group(1)}_{m.group(3)}".lower()
    appx = _load_appx_display_names()
    display_name = appx.get(family)
    return (family, display_name) if display_name else (None, None)


def is_monitor_runtime(pid: int, proc: Optional[psutil.Process] = None) -> bool:
    """Identify this checkout's backend/frontend runtimes without hiding unrelated tools."""
    try:
        p = proc or psutil.Process(pid)
        name = _safe_proc_name(p).lower()
        cmd = " ".join(_safe_cmdline(p)).lower()
        cwd = os.path.normcase(os.path.abspath(p.cwd()))
        root = os.path.normcase(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))
        is_checkout_process = os.path.commonpath((root, cwd)) == root
        if not is_checkout_process:
            return False
        if name in ("python.exe", "pythonw.exe", "uvicorn.exe"):
            return "uvicorn" in cmd and "app.main" in cmd
        if name == "node.exe":
            return "next" in cmd and ("dev" in cmd or "start" in cmd)
    except (psutil.NoSuchProcess, psutil.AccessDenied, OSError, ValueError):
        pass
    return False


def _walk_parent_chain(
    pid: int,
    create_time: float,
    max_depth: int = 8,
) -> list[tuple[int, str, float]]:
    """Return list of (pid, name, create_time) from pid up to root."""
    chain: list[tuple[int, str, float]] = []
    seen: set[int] = set()
    current_pid = pid
    depth = 0
    while current_pid and depth < max_depth and current_pid not in seen:
        seen.add(current_pid)
        try:
            p = psutil.Process(current_pid)
            ct = p.create_time()
            nm = _safe_proc_name(p)
            chain.append((current_pid, nm, ct))
            current_pid = p.ppid()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            break
        depth += 1
    return chain


def _browser_root_from_chain(chain: list[tuple[int, str, float]]) -> Optional[tuple[str, str, str]]:
    """Return (application_id, display_name, root_process_name) if chain under a browser."""
    for _pid, name, _ct in chain:
        nlower = name.lower()
        if nlower in _BROWSER_ROOTS:
            app_id, disp = _BROWSER_ROOTS[nlower]
            return app_id, disp, nlower
    return None


def resolve_process_identity(
    pid: int,
    proc: Optional[psutil.Process] = None,
    process_name: Optional[str] = None,
    create_time: Optional[float] = None,
    parent_name: Optional[str] = None,
    ppid: Optional[int] = None,
) -> ProcessIdentity:
    """
    Resolve identity for a single PID. Results cached by (pid, create_time).
    """
    try:
        p = proc or psutil.Process(pid)
        if create_time is None:
            create_time = p.create_time()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return ProcessIdentity(
            pid=pid,
            process_name="unknown",
            display_name="unknown",
            display_source="process_name",
            confidence=0.0,
            application_id=f"pid:{pid}",
            role="unknown",
            is_fallback_label=True,
        )

    cached = _identity_cache.get(pid)
    if cached and abs(cached[0] - create_time) < 1.0:
        return cached[1]

    process_name = process_name or _safe_proc_name(p)
    name_lower = process_name.lower()
    exe_path = _safe_exe_path(p)

    if name_lower in {"python.exe", "pythonw.exe", "uvicorn.exe", "node.exe"} and is_monitor_runtime(pid, p):
        ident = ProcessIdentity(
            pid=pid,
            process_name=process_name,
            display_name="SYSTEMOS Monitor",
            display_source="monitor_runtime",
            confidence=1.0,
            application_id="systemos-monitor",
            role="monitor_runtime",
            exe_path=exe_path,
            parent_pid=ppid,
            parent_process_name=parent_name,
            is_fallback_label=False,
        )
        _identity_cache[pid] = (create_time, ident)
        return ident

    browser = _BROWSER_ROOTS.get(name_lower)
    if browser:
        browser = (*browser, name_lower)
    elif name_lower in _EDGE_HELPERS or "webview" in name_lower:
        browser = _browser_root_from_chain(_walk_parent_chain(pid, create_time))
    else:
        browser = None

    windows_root = os.path.normcase(os.path.abspath(os.environ.get("SystemRoot", r"C:\Windows")))
    normalized_exe = os.path.normcase(os.path.abspath(exe_path)) if exe_path else ""
    is_windows_binary = normalized_exe == windows_root or normalized_exe.startswith(
        windows_root.rstrip(os.sep) + os.sep
    )
    known_without_metadata = (
        name_lower in _WINDOWS_SERVICE_PROCESSES
        or name_lower == "explorer.exe"
        or name_lower in _KNOWN_WINDOWS_APPS
        or name_lower in _KNOWN_RUNTIME_PROCESSES
        or browser is not None
        or is_windows_binary
    )
    file_desc, product_name, company = (
        _read_pe_strings(exe_path) if not known_without_metadata else (None, None, None)
    )
    pkg_family, pkg_display = (
        _package_from_path(exe_path)
        if exe_path and "\\windowsapps\\" in exe_path.lower()
        else (None, None)
    )

    display_name = process_name
    display_source = "process_name"
    confidence = 0.35
    application_id = f"proc:{name_lower}:{pid}"
    role = "unknown"
    is_fallback = True
    publisher = company

    # OS service hosts are not user applications even when their binaries
    # carry a descriptive Windows product name.
    if name_lower in _WINDOWS_SERVICE_PROCESSES:
        display_name = file_desc or process_name
        display_source = "windows_service"
        confidence = 0.95 if file_desc else 0.8
        application_id = f"windows-service:{name_lower}"
        role = "service"
        is_fallback = False
    elif name_lower == "explorer.exe":
        display_name = "Windows Explorer"
        display_source = "system_mapping"
        confidence = 0.95
        application_id = "windows-explorer"
        role = "system"
        is_fallback = False
    elif name_lower in _KNOWN_WINDOWS_APPS:
        application_id, display_name = _KNOWN_WINDOWS_APPS[name_lower]
        display_source = "system_mapping"
        confidence = 0.95
        role = "user_app"
        is_fallback = False
    elif name_lower in _KNOWN_RUNTIME_PROCESSES:
        application_id, display_name = _KNOWN_RUNTIME_PROCESSES[name_lower]
        display_source = "known_runtime"
        confidence = 0.85
        role = "background"
        is_fallback = False
    elif name_lower == "code.exe" and any(
        value and "visual studio code" in value.lower()
        for value in (product_name, file_desc)
    ):
        display_name = "Visual Studio Code"
        display_source = "pe_metadata"
        confidence = 0.92
        application_id = "visual-studio-code"
        role = "user_app"
        is_fallback = False

    # 2) Browser family grouping
    elif browser:
        application_id, display_name, _root = browser
        display_source = "parent_chain"
        confidence = 0.92
        role = "user_app"
        is_fallback = False
        if name_lower in _EDGE_HELPERS or "webview" in name_lower:
            role = "helper"
    elif name_lower in _BROWSER_ROOTS:
        application_id, display_name = _BROWSER_ROOTS[name_lower]
        display_source = "known_browser"
        confidence = 0.95
        role = "user_app"
        is_fallback = False

    # 3) UWP / Store package path
    elif pkg_display and pkg_family:
        application_id = f"uwp:{pkg_family.lower()}"
        display_name = pkg_display
        display_source = "appx_package"
        confidence = 0.88
        role = "user_app"
        is_fallback = False

    # 4) PE metadata (non-generic)
    elif file_desc and file_desc.lower() not in _GENERIC_PE_DESCRIPTIONS:
        display_name = file_desc
        display_source = "pe_file_description"
        confidence = 0.85
        application_id = f"app:{re.sub(r'[^a-z0-9]+', '-', file_desc.lower())[:48]}"
        role = "user_app"
        is_fallback = False
    elif product_name and product_name.lower() not in _GENERIC_PE_DESCRIPTIONS:
        display_name = product_name
        display_source = "pe_product_name"
        confidence = 0.8
        application_id = f"app:{re.sub(r'[^a-z0-9]+', '-', product_name.lower())[:48]}"
        role = "user_app"
        is_fallback = False

    # 5) Services / helpers
    if role == "unknown":
        if name_lower.endswith("service.exe") or name_lower in ("svchost.exe", "dllhost.exe"):
            role = "service"
        elif name_lower in _EDGE_HELPERS:
            role = "helper"
            display_name = f"{process_name} (helper)"
            is_fallback = True
            confidence = min(confidence, 0.5)
        else:
            role = "background"

    if is_fallback and display_name == process_name:
        display_name = f"{process_name} (unidentified application)"

    ident = ProcessIdentity(
        pid=pid,
        process_name=process_name,
        display_name=display_name,
        display_source=display_source,
        confidence=confidence,
        application_id=application_id,
        role=role,
        exe_path=exe_path,
        publisher=publisher,
        package_family=pkg_family,
        parent_pid=ppid,
        parent_process_name=parent_name,
        ppid_chain_root_id=browser[0] if browser else None,
        is_fallback_label=is_fallback,
    )
    _identity_cache[pid] = (create_time, ident)
    return ident


@dataclass
class ApplicationGroup:
    application_id: str
    display_name: str
    display_source: str
    confidence: float
    role: str
    is_fallback_label: bool
    process_count: int
    cpu_percent: float
    memory_bytes: int
    memory_percent: float
    memory_mb: float
    is_foreground: bool
    processes: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def aggregate_identities_to_applications(
    profiles: list[dict],
    foreground_pid: Optional[int] = None,
) -> list[ApplicationGroup]:
    """
    Group live process profiles (from inspect_live_process) by application_id.
    Each profile may include identity fields and cpu/memory metrics.
    """
    metrics: dict[int, dict] = {}
    identities: list[ProcessIdentity] = []
    for p in profiles:
        pid = p.get("pid")
        if not pid:
            continue
        ident_dict = p.get("identity")
        if ident_dict:
            ident = ProcessIdentity(**{k: ident_dict[k] for k in ProcessIdentity.__dataclass_fields__ if k in ident_dict})
        else:
            ident = resolve_process_identity(int(pid))
        identities.append(ident)
        metrics[int(pid)] = {
            "cpu_percent": p.get("cpu_percent") or 0.0,
            "memory_bytes": p.get("memory_bytes") or 0,
            "memory_percent": p.get("memory_percent") or 0.0,
            "status": p.get("status"),
            "create_time": p.get("create_time"),
            "is_foreground": foreground_pid is not None and int(pid) == int(foreground_pid),
        }

    raw_groups = aggregate_applications(identities, metrics)
    groups: list[ApplicationGroup] = []
    for g in raw_groups:
        groups.append(
            ApplicationGroup(
                application_id=g["application_id"],
                display_name=g["display_name"],
                display_source=g["display_source"],
                confidence=g["confidence"],
                role=g["role"],
                is_fallback_label=g["is_fallback_label"],
                process_count=g["process_count"],
                cpu_percent=g["cpu_percent"],
                memory_bytes=g["memory_bytes"],
                memory_percent=g["memory_percent"],
                memory_mb=g["memory_mb"],
                is_foreground=g["is_foreground"],
                processes=g["processes"],
            )
        )
    return groups


def aggregate_applications(identities: list[ProcessIdentity], metrics: dict[int, dict]) -> list[dict]:
    """
    Group identities by application_id and sum CPU/memory metrics without double-counting PIDs.
    metrics: pid -> {cpu_percent, memory_bytes, memory_percent, status, ...}
    """
    groups: dict[str, dict] = {}
    seen_pids: set[int] = set()
    for ident in identities:
        pid = ident.pid
        if pid in seen_pids:
            continue
        seen_pids.add(pid)
        m = metrics.get(pid, {})

        gid = ident.application_id
        if gid not in groups:
            groups[gid] = {
                "application_id": gid,
                "display_name": ident.display_name,
                "display_source": ident.display_source,
                "confidence": ident.confidence,
                "role": ident.role,
                "is_fallback_label": ident.is_fallback_label,
                "process_count": 0,
                "cpu_percent": 0.0,
                "memory_bytes": 0,
                "memory_percent": 0.0,
                "is_foreground": False,
                "processes": [],
            }

        g = groups[gid]
        g["process_count"] += 1
        g["cpu_percent"] = round(g["cpu_percent"] + float(m.get("cpu_percent") or 0.0), 2)
        g["memory_bytes"] += int(m.get("memory_bytes") or 0)
        g["memory_percent"] = round(g["memory_percent"] + float(m.get("memory_percent") or 0.0), 2)
        if m.get("is_foreground"):
            g["is_foreground"] = True
        role_priority = {
            "user_app": 0,
            "monitor_runtime": 1,
            "helper": 2,
            "background": 3,
            "unknown": 4,
            "service": 5,
            "system": 6,
        }
        if (
            ident.confidence > g["confidence"]
            or role_priority.get(ident.role, 4) < role_priority.get(g["role"], 4)
        ):
            g["display_name"] = ident.display_name
            g["display_source"] = ident.display_source
            g["confidence"] = ident.confidence
            g["role"] = ident.role
            g["is_fallback_label"] = ident.is_fallback_label
        g["processes"].append({
            **ident.to_dict(),
            "cpu_percent": m.get("cpu_percent"),
            "memory_bytes": m.get("memory_bytes"),
            "memory_percent": m.get("memory_percent"),
            "status": m.get("status"),
            "create_time": m.get("create_time"),
            "is_foreground": bool(m.get("is_foreground")),
        })

    result = list(groups.values())
    for g in result:
        g["memory_mb"] = round(g["memory_bytes"] / (1024 * 1024), 1)
    result.sort(key=lambda x: (x["cpu_percent"], x["memory_bytes"]), reverse=True)
    return result


def clear_identity_cache():
    _identity_cache.clear()
