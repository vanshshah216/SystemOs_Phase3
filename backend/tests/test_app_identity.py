"""Unit tests for application identity resolution and grouping."""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.collector.app_identity import (
    ProcessIdentity,
    aggregate_applications,
    is_monitor_runtime,
    resolve_process_identity,
    _browser_root_from_chain,
    recognizable_application_name,
)


def test_browser_root_from_chain():
    chain = [(5000, "msedgewebview2.exe", 1.0), (4000, "msedge.exe", 1.0)]
    root = _browser_root_from_chain(chain)
    assert root is not None
    assert root[0] == "microsoft-edge"
    assert root[1] == "Microsoft Edge"


def test_aggregate_no_double_count():
    idents = [
        ProcessIdentity(
            pid=1, process_name="msedge.exe", display_name="Microsoft Edge",
            display_source="parent_chain", confidence=0.9, application_id="microsoft-edge",
            role="user_app",
        ),
        ProcessIdentity(
            pid=2, process_name="msedgewebview2.exe", display_name="Microsoft Edge",
            display_source="parent_chain", confidence=0.9, application_id="microsoft-edge",
            role="helper",
        ),
    ]
    metrics = {
        1: {"cpu_percent": 10.0, "memory_bytes": 100_000_000, "memory_percent": 2.0},
        2: {"cpu_percent": 5.0, "memory_bytes": 50_000_000, "memory_percent": 1.0},
    }
    groups = aggregate_applications(idents, metrics)
    assert len(groups) == 1
    assert groups[0]["process_count"] == 2
    assert groups[0]["cpu_percent"] == 15.0
    assert groups[0]["memory_bytes"] == 150_000_000


def test_aggregate_deduplicates_duplicate_pid_rows():
    ident = ProcessIdentity(
        pid=42, process_name="chrome.exe", display_name="Google Chrome",
        display_source="known_browser", confidence=0.95,
        application_id="google-chrome", role="user_app",
    )
    groups = aggregate_applications(
        [ident, ident],
        {42: {"cpu_percent": 10.0, "memory_bytes": 100, "memory_percent": 1.0}},
    )
    assert len(groups) == 1
    assert groups[0]["process_count"] == 1
    assert groups[0]["cpu_percent"] == 10.0
    assert groups[0]["memory_bytes"] == 100


def test_windows_store_package_family_uses_installed_app_name():
    with patch(
        "app.collector.app_identity._load_appx_display_names",
        return_value={"microsoft.windowsstore_8wekyb3d8bbwe": "Microsoft Store"},
    ):
        from app.collector.app_identity import _package_from_path

        family, display = _package_from_path(
            r"C:\Program Files\WindowsApps\Microsoft.WindowsStore_22307.1401.5.0_x64__8wekyb3d8bbwe\WinStore.App.exe"
        )
    assert family == "microsoft.windowsstore_8wekyb3d8bbwe"
    assert display == "Microsoft Store"


def test_monitor_runtime_cmdline():
    proc = MagicMock()
    proc.name.return_value = "python.exe"
    proc.cmdline.return_value = ["python", "-m", "uvicorn", "app.main:app"]
    proc.exe.return_value = r"C:\Python\python.exe"
    proc.cwd.return_value = str(Path(__file__).resolve().parents[2])
    assert is_monitor_runtime(1234, proc) is True


def test_known_browser_identity_skips_expensive_metadata_lookup():
    from app.collector.app_identity import clear_identity_cache

    clear_identity_cache()
    proc = MagicMock()
    proc.create_time.return_value = 2000.0
    proc.name.return_value = "chrome.exe"
    proc.ppid.return_value = 1
    proc.exe.return_value = None

    with patch("app.collector.app_identity.is_monitor_runtime") as monitor_check, patch(
        "app.collector.app_identity._read_pe_strings"
    ) as pe_lookup:
        ident = resolve_process_identity(
            900001,
            proc=proc,
            process_name="chrome.exe",
            create_time=2000.0,
        )

    assert ident.display_name == "Google Chrome"
    assert ident.application_id == "google-chrome"
    monitor_check.assert_not_called()
    pe_lookup.assert_not_called()
    clear_identity_cache()


def test_paint_has_recognizable_identity():
    from app.collector.app_identity import clear_identity_cache

    clear_identity_cache()
    proc = MagicMock()
    proc.create_time.return_value = 3000.0
    proc.name.return_value = "mspaint.exe"
    proc.ppid.return_value = 1
    proc.exe.return_value = r"C:\Windows\System32\mspaint.exe"

    ident = resolve_process_identity(
        900002,
        proc=proc,
        process_name="mspaint.exe",
        create_time=3000.0,
    )

    assert ident.display_name == "Microsoft Paint"
    assert ident.application_id == "microsoft-paint"
    assert ident.role == "user_app"
    clear_identity_cache()


def test_microsoft_store_host_has_recognizable_identity_without_package_path():
    from app.collector.app_identity import clear_identity_cache

    clear_identity_cache()
    proc = MagicMock()
    proc.create_time.return_value = 4000.0
    proc.name.return_value = "WinStore.App.exe"
    proc.exe.return_value = None

    ident = resolve_process_identity(
        900003,
        proc=proc,
        process_name="WinStore.App.exe",
        create_time=4000.0,
    )

    assert ident.display_name == "Microsoft Store"
    assert ident.application_id == "microsoft-store"
    assert ident.role == "user_app"
    clear_identity_cache()


def test_historical_store_process_name_resolves_to_application_name():
    assert recognizable_application_name("WinStore.App.exe") == "Microsoft Store"


def test_python_runtime_gets_a_readable_name():
    from app.collector.app_identity import clear_identity_cache

    clear_identity_cache()
    proc = MagicMock()
    proc.create_time.return_value = 5000.0
    proc.name.return_value = "python.exe"
    proc.exe.return_value = None

    with patch("app.collector.app_identity.is_monitor_runtime", return_value=False):
        ident = resolve_process_identity(
            900004,
            proc=proc,
            process_name="python.exe",
            create_time=5000.0,
        )

    assert ident.display_name == "Python"
    assert ident.role == "background"
    clear_identity_cache()


def test_resolve_fallback_unknown():
    with patch("app.collector.app_identity.psutil.Process") as mock_p:
        mock_proc = MagicMock()
        mock_proc.create_time.return_value = 1000.0
        mock_proc.name.return_value = "weirdproc.exe"
        mock_proc.ppid.return_value = 999
        mock_proc.exe.side_effect = OSError()
        mock_proc.cmdline.return_value = []
        mock_p.return_value = mock_proc
        with patch("app.collector.app_identity.is_monitor_runtime", return_value=False):
            with patch("app.collector.app_identity._walk_parent_chain", return_value=[]):
                with patch("app.collector.app_identity._read_pe_strings", return_value=(None, None, None)):
                    with patch("app.collector.app_identity._package_from_path", return_value=(None, None)):
                        ident = resolve_process_identity(5555)
    assert "weirdproc.exe" in ident.display_name
    assert ident.is_fallback_label is True
