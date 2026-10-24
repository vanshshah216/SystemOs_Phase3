from app.collector import telemetry


def test_collect_once_stores_metrics_and_processes_at_same_sample_time(monkeypatch):
    stored_metrics = []
    stored_processes = []
    process_rows = [{"timestamp": 1001.0, "pid": 42}]
    monotonic_values = iter((10.0, 11.0))

    monkeypatch.setattr(
        telemetry,
        "collect_system_metrics",
        lambda is_demo=False: {"timestamp": 1000.0, "is_demo": int(is_demo)},
    )
    monkeypatch.setattr(
        telemetry,
        "collect_process_snapshots",
        lambda is_demo=False: process_rows,
    )
    monkeypatch.setattr(telemetry, "store_system_metric", lambda row: stored_metrics.append(row.copy()))
    monkeypatch.setattr(telemetry, "store_process_snapshots", lambda rows: stored_processes.extend(rows))
    monkeypatch.setattr(telemetry, "get_setting", lambda *args: "3")
    monkeypatch.setattr(telemetry.time, "time", lambda: 1002.0)
    monkeypatch.setattr(telemetry.time, "monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr(
        "app.services.pipeline.run_analysis_pipeline",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.diagnosis.process_analyzer.invalidate_process_cache",
        lambda: None,
    )
    monkeypatch.setattr(
        "app.services.application_lifecycle.record_application_starts",
        lambda *args: 0,
    )
    monkeypatch.setattr(
        "app.services.applications.record_foreground_application",
        lambda *args: None,
    )

    result = telemetry.collect_once()

    assert stored_metrics[0]["timestamp"] == 1002.0
    assert stored_processes[0]["timestamp"] == 1002.0
    assert result["timestamp"] == 1002.0
    assert result["process_count"] == 1
    assert telemetry.get_collector_status()["last_collection_time"] == 1002.0
