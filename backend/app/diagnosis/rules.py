"""
diagnosis/rules.py – Explicit diagnosis rule engine (Rules A–E).

Rules are evaluated in priority order. The first matching rule produces
a DiagnosisCandidate. Rules are NOT machine-learning – every condition
is an explicit, inspectable check.

Rules:
  A – Sustained CPU Contention
  B – Memory Pressure (with optional disk correlation)
  C – Disk I/O Bottleneck
  D – Network-Heavy Behaviour
  E – Process Memory Growth
"""

from dataclasses import dataclass, field
from typing import Optional
from app.diagnosis.anomaly   import AnomalyResult
from app.diagnosis.persistence import PersistenceState
from app.diagnosis.evidence  import compute_evidence_strength

MEMORY_GROWTH_MIN_SAMPLES = 20
MEMORY_GROWTH_MIN_DURATION_SECONDS = 15 * 60
MEMORY_GROWTH_MIN_NET_MB = 256.0
MEMORY_GROWTH_MIN_RATE_MB_PER_MINUTE = 1.0
MEMORY_GROWTH_MIN_RISING_SAMPLE_RATIO = 0.6


@dataclass
class DiagnosisCandidate:
    rule_id:         str
    probable_cause:  str
    severity:        str          # HIGH | MEDIUM | LOW
    primary_process: Optional[str]
    evidence_items:  list[str]    # human-readable evidence bullets
    evidence_strength: dict       # from compute_evidence_strength()
    raw_stats:       dict = field(default_factory=dict)
    incident_key:    Optional[str] = None
    category:        Optional[str] = None
    primary_pid:     Optional[int] = None
    primary_display_name: Optional[str] = None
    primary_process_name: Optional[str] = None
    application_id:  Optional[str] = None


# ── Rule helpers ───────────────────────────────────────────────────────────────

def _is_sustained(state: Optional[PersistenceState]) -> bool:
    return state is not None and state.is_sustained


def _consecutive(state: Optional[PersistenceState]) -> int:
    return state.consecutive_anomalies if state else 0


def _duration_str(state: Optional[PersistenceState], interval: float = 3.0) -> str:
    if state and state.first_anomaly_time and state.last_anomaly_time:
        secs = state.last_anomaly_time - state.first_anomaly_time
        return f"{secs:.0f}s"
    return "unknown"


# ── Rule A – Sustained CPU Contention ─────────────────────────────────────────

def rule_a_cpu_contention(
    cpu_anomaly:   AnomalyResult,
    cpu_state:     Optional[PersistenceState],
    cpu_ranking:   list[dict],
    disk_anomaly:  Optional[AnomalyResult] = None,
    interval: float = 3.0,
) -> Optional[DiagnosisCandidate]:
    if not (cpu_anomaly.is_anomaly and _is_sustained(cpu_state)):
        return None

    top_row   = cpu_ranking[0] if cpu_ranking else {}
    top_proc  = top_row.get("name")
    top_exe   = top_row.get("process_name")
    top_pid   = top_row.get("pid")
    top_app   = top_row.get("application_id")
    top_cpu   = top_row.get("avg_value", 0) if cpu_ranking else 0
    n         = _consecutive(cpu_state)
    corr      = 1 if (disk_anomaly and disk_anomaly.is_anomaly) else 0

    ev = compute_evidence_strength(
        zscore=cpu_anomaly.zscore,
        consecutive_anomalies=n,
        process_ranking=cpu_ranking,
        correlated_metrics_count=corr,
        total_monitored_metrics=4,
        trend_slope=cpu_anomaly.trend_slope,
    )

    bullets = [
        f"CPU at {cpu_anomaly.current:.1f}% vs historical baseline {cpu_anomaly.mean:.1f}%",
        f"Z-score: {cpu_anomaly.zscore:.2f} (threshold: {2.0})",
        f"Condition persisted for {n} consecutive samples ({_duration_str(cpu_state, interval)})",
        (
            f"{top_proc} ({top_exe}, PID {top_pid}) had the highest measured process CPU "
            f"({top_cpu:.1f}% average); correlation does not establish causation."
            if top_pid
            else "No current process could be confidently associated with this system CPU condition."
        ),
    ]
    if disk_anomaly and disk_anomaly.is_anomaly:
        bullets.append("Disk activity also elevated during the same window")

    return DiagnosisCandidate(
        rule_id="A",
        incident_key="A",
        category="cpu",
        probable_cause=(
            "Sustained CPU contention (process association is suspected, not confirmed)"
            if top_pid else "Sustained CPU contention; process cause not established"
        ),
        severity="HIGH",
        primary_process=top_proc,
        primary_display_name=top_proc,
        primary_process_name=top_exe,
        primary_pid=top_pid,
        application_id=top_app,
        evidence_items=bullets,
        evidence_strength=ev,
        raw_stats={
            "cpu_mean": cpu_anomaly.mean,
            "cpu_current": cpu_anomaly.current,
            "cpu_zscore": cpu_anomaly.zscore,
            "duration_samples": n,
            "top_cpu_process": top_proc,
        },
    )


# ── Rule B – Memory Pressure ───────────────────────────────────────────────────

def rule_b_memory_pressure(
    ram_anomaly:   AnomalyResult,
    ram_state:     Optional[PersistenceState],
    mem_ranking:   list[dict],
    disk_anomaly:  Optional[AnomalyResult] = None,
    interval: float = 3.0,
) -> Optional[DiagnosisCandidate]:
    if not (ram_anomaly.is_anomaly and _is_sustained(ram_state)):
        return None

    top_row  = mem_ranking[0] if mem_ranking else {}
    top_proc = top_row.get("name")
    top_exe  = top_row.get("process_name")
    top_pid  = top_row.get("pid")
    top_app  = top_row.get("application_id")
    n        = _consecutive(ram_state)
    disk_up  = disk_anomaly is not None and disk_anomaly.is_anomaly
    corr     = 1 if disk_up else 0

    cause = ("Memory pressure with increased disk activity" if disk_up
             else "Sustained memory pressure")

    ev = compute_evidence_strength(
        zscore=ram_anomaly.zscore,
        consecutive_anomalies=n,
        process_ranking=mem_ranking,
        correlated_metrics_count=corr,
        total_monitored_metrics=4,
        trend_slope=ram_anomaly.trend_slope,
    )

    bullets = [
        f"RAM at {ram_anomaly.current:.1f}% vs historical baseline {ram_anomaly.mean:.1f}%",
        f"Z-score: {ram_anomaly.zscore:.2f}",
        f"Condition persisted for {n} consecutive samples ({_duration_str(ram_state, interval)})",
    ]
    if disk_up:
        bullets.append(f"Disk activity elevated simultaneously (z={disk_anomaly.zscore:.2f})")
    bullets.append(
        (
            f"{top_proc} ({top_exe}, PID {top_pid}) was the largest measured resident-memory "
            "consumer; this does not establish that it caused system memory pressure."
            if top_pid
            else "Process-level memory attribution was unavailable for this condition."
        )
    )

    return DiagnosisCandidate(
        rule_id="B",
        incident_key="B",
        category="memory",
        probable_cause=(
            f"{cause} (process association is suspected, not confirmed)"
            if top_pid else f"{cause}; process cause not established"
        ),
        severity="HIGH",
        primary_process=top_proc,
        primary_display_name=top_proc,
        primary_process_name=top_exe,
        primary_pid=top_pid,
        application_id=top_app,
        evidence_items=bullets,
        evidence_strength=ev,
        raw_stats={
            "ram_mean": ram_anomaly.mean,
            "ram_current": ram_anomaly.current,
            "ram_zscore": ram_anomaly.zscore,
            "duration_samples": n,
            "disk_elevated": disk_up,
            "top_memory_process": top_proc,
        },
    )


# ── Rule C – Disk I/O Bottleneck ──────────────────────────────────────────────

def rule_c_disk_bottleneck(
    disk_read_anomaly:  AnomalyResult,
    disk_write_anomaly: AnomalyResult,
    disk_read_state:    Optional[PersistenceState],
    disk_write_state:   Optional[PersistenceState],
    disk_ranking:       list[dict],
    interval: float = 3.0,
) -> Optional[DiagnosisCandidate]:
    # Either read or write needs to be sustained
    read_sus  = disk_read_anomaly.is_anomaly  and _is_sustained(disk_read_state)
    write_sus = disk_write_anomaly.is_anomaly and _is_sustained(disk_write_state)

    if not (read_sus or write_sus):
        return None

    top_row  = disk_ranking[0] if disk_ranking else {}
    top_proc = top_row.get("name")
    top_exe  = top_row.get("process_name")
    top_pid  = top_row.get("pid")
    top_app  = top_row.get("application_id")
    state    = disk_read_state if read_sus else disk_write_state
    n        = _consecutive(state)
    anomaly  = disk_read_anomaly if read_sus else disk_write_anomaly

    ev = compute_evidence_strength(
        zscore=anomaly.zscore,
        consecutive_anomalies=n,
        process_ranking=disk_ranking,
        correlated_metrics_count=0,
        total_monitored_metrics=4,
        trend_slope=anomaly.trend_slope,
    )

    bullets = [
        f"{'Read' if read_sus else 'Write'} I/O statistically unusual (z={anomaly.zscore:.2f})",
        f"Condition persisted for {n} consecutive samples ({_duration_str(state, interval)})",
        (
            f"{top_proc} ({top_exe}, PID {top_pid}) had the highest measured process disk I/O; "
            "correlation does not establish causation."
            if top_pid
            else "Process-level disk attribution was unavailable for this condition."
        ),
    ]

    return DiagnosisCandidate(
        rule_id="C",
        incident_key="C",
        category="disk",
        probable_cause=(
            "Sustained storage I/O activity (process association is suspected, not confirmed)"
            if top_pid else "Sustained storage I/O activity; process cause not established"
        ),
        severity="MEDIUM",
        primary_process=top_proc,
        primary_display_name=top_proc,
        primary_process_name=top_exe,
        primary_pid=top_pid,
        application_id=top_app,
        evidence_items=bullets,
        evidence_strength=ev,
        raw_stats={"duration_samples": n, "top_disk_process": top_proc},
    )


# ── Rule D – Network-Heavy Behaviour ──────────────────────────────────────────

def rule_d_network_heavy(
    net_recv_anomaly: AnomalyResult,
    net_sent_anomaly: AnomalyResult,
    net_recv_state:   Optional[PersistenceState],
    net_sent_state:   Optional[PersistenceState],
    interval: float = 3.0,
) -> Optional[DiagnosisCandidate]:
    recv_sus = net_recv_anomaly.is_anomaly and _is_sustained(net_recv_state)
    sent_sus = net_sent_anomaly.is_anomaly and _is_sustained(net_sent_state)

    if not (recv_sus or sent_sus):
        return None

    state   = net_recv_state if recv_sus else net_sent_state
    anomaly = net_recv_anomaly if recv_sus else net_sent_anomaly
    n       = _consecutive(state)

    ev = compute_evidence_strength(
        zscore=anomaly.zscore,
        consecutive_anomalies=n,
        process_ranking=[],
        correlated_metrics_count=1 if (recv_sus and sent_sus) else 0,
        total_monitored_metrics=4,
        trend_slope=anomaly.trend_slope,
    )

    direction = "receive" if recv_sus else "send"
    bullets = [
        f"Network {direction} throughput statistically unusual (z={anomaly.zscore:.2f})",
        f"Condition persisted for {n} consecutive samples ({_duration_str(state, interval)})",
    ]
    if recv_sus and sent_sus:
        bullets.append("Both inbound and outbound traffic elevated")

    return DiagnosisCandidate(
        rule_id="D",
        incident_key="D",
        category="network",
        probable_cause="Sustained network-heavy workload",
        severity="MEDIUM",
        primary_process=None,
        evidence_items=bullets,
        evidence_strength=ev,
        raw_stats={"duration_samples": n},
    )


# ── Rule E – Process Memory Growth ────────────────────────────────────────────

def rule_e_process_memory_growth(
    process_name:   str,
    memory_slope:   float,
    sample_count:   int,
    current_bytes:  float,
    baseline_bytes: float,
    pid:            Optional[int] = None,
    create_time:    Optional[float] = None,
    display_name:   Optional[str] = None,
    application_id: Optional[str] = None,
    observation_seconds: float = 0.0,
    rising_sample_ratio: float = 0.0,
    observation_start_time: Optional[float] = None,
) -> Optional[DiagnosisCandidate]:
    """
    Record a substantial, sustained memory increase as a low-severity observation.
    """
    slope_mb = memory_slope / (1024 * 1024)
    growth_mb = (current_bytes - baseline_bytes) / (1024 * 1024)
    slope_mb_per_minute = (
        slope_mb * max(sample_count - 1, 0) * 60 / observation_seconds
        if observation_seconds > 0
        else 0.0
    )

    if (
        sample_count < MEMORY_GROWTH_MIN_SAMPLES
        or observation_seconds < MEMORY_GROWTH_MIN_DURATION_SECONDS
        or growth_mb < MEMORY_GROWTH_MIN_NET_MB
        or slope_mb_per_minute < MEMORY_GROWTH_MIN_RATE_MB_PER_MINUTE
        or rising_sample_ratio < MEMORY_GROWTH_MIN_RISING_SAMPLE_RATIO
    ):
        return None

    label = display_name or process_name
    incident_key = f"E:{pid}:{int(create_time or 0)}" if pid else f"E:{process_name}"
    observed_minutes = observation_seconds / 60

    bullets = [
        f"Resident memory for {label} increased by {growth_mb:.0f} MB over {observed_minutes:.0f} minutes.",
        f"The increase was measured across {sample_count} samples (about {slope_mb_per_minute:.1f} MB per minute on average).",
        f"Memory rose between {rising_sample_ratio:.0%} of consecutive samples.",
        "This is an observation, not proof of a fault or slowdown. Normal app activity and caching can increase memory use.",
    ]

    return DiagnosisCandidate(
        rule_id="E",
        incident_key=incident_key,
        category="memory",
        probable_cause=f"Gradual memory increase observed for {label}",
        severity="LOW",
        primary_process=label,
        primary_process_name=process_name,
        primary_display_name=label,
        primary_pid=pid,
        application_id=application_id,
        evidence_items=bullets,
        evidence_strength=None,
        raw_stats={
            "rule_id": "E",
            "slope_mb_per_sample": slope_mb,
            "slope_mb_per_minute": slope_mb_per_minute,
            "sample_count": sample_count,
            "growth_mb": growth_mb,
            "observation_seconds": observation_seconds,
            "rising_sample_ratio": rising_sample_ratio,
            "observation_start_time": observation_start_time,
            "pid": pid,
            "process_name": process_name,
        },
    )


# ── Master rule evaluator ──────────────────────────────────────────────────────

def evaluate_rules(
    anomalies:    dict,    # metric_name → AnomalyResult
    states:       dict,    # metric_name → PersistenceState
    rankings:     dict,    # "cpu" | "memory" | "disk" → list[dict]
    interval:     float = 3.0,
    memory_growth_candidates: Optional[list[dict]] = None,
) -> list[DiagnosisCandidate]:
    """
    Evaluate all rules and return matched DiagnosisCandidates.
    Multiple rules can fire simultaneously.
    """
    candidates = []

    cpu = anomalies.get("cpu_percent")
    ram = anomalies.get("ram_percent")
    drd = anomalies.get("disk_read_bytes")
    dwr = anomalies.get("disk_write_bytes")
    nrs = anomalies.get("network_recv_bytes")
    nss = anomalies.get("network_sent_bytes")

    # Rule A – CPU
    if cpu:
        c = rule_a_cpu_contention(
            cpu_anomaly=cpu,
            cpu_state=states.get("cpu_percent"),
            cpu_ranking=rankings.get("cpu", []),
            disk_anomaly=drd or dwr,
            interval=interval,
        )
        if c:
            candidates.append(c)

    # Rule B – Memory
    if ram:
        c = rule_b_memory_pressure(
            ram_anomaly=ram,
            ram_state=states.get("ram_percent"),
            mem_ranking=rankings.get("memory", []),
            disk_anomaly=drd or dwr,
            interval=interval,
        )
        if c:
            candidates.append(c)

    # Rule C – Disk
    if drd and dwr:
        c = rule_c_disk_bottleneck(
            disk_read_anomaly=drd,
            disk_write_anomaly=dwr,
            disk_read_state=states.get("disk_read_bytes"),
            disk_write_state=states.get("disk_write_bytes"),
            disk_ranking=rankings.get("disk", []),
            interval=interval,
        )
        if c:
            candidates.append(c)

    # Rule D – Network
    if nrs and nss:
        c = rule_d_network_heavy(
            net_recv_anomaly=nrs,
            net_sent_anomaly=nss,
            net_recv_state=states.get("network_recv_bytes"),
            net_sent_state=states.get("network_sent_bytes"),
            interval=interval,
        )
        if c:
            candidates.append(c)

    # Rule E – Process Memory Growth
    if memory_growth_candidates:
        for mgc in memory_growth_candidates:
            c = rule_e_process_memory_growth(
                process_name=mgc.get("name") or mgc.get("process_name", "unknown"),
                memory_slope=mgc.get("memory_slope", 0.0),
                sample_count=mgc.get("sample_count", 0),
                current_bytes=mgc.get("current_bytes", 0.0),
                baseline_bytes=mgc.get("baseline_bytes", 0.0),
                pid=mgc.get("pid"),
                create_time=mgc.get("create_time"),
                display_name=mgc.get("display_name"),
                application_id=mgc.get("application_id"),
                observation_seconds=mgc.get("observation_seconds", 0.0),
                rising_sample_ratio=mgc.get("rising_sample_ratio", 0.0),
                observation_start_time=mgc.get("observation_start_time"),
            )
            if c:
                candidates.append(c)

    return candidates
