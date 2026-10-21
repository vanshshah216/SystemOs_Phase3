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


@dataclass
class DiagnosisCandidate:
    rule_id:         str
    probable_cause:  str
    severity:        str          # HIGH | MEDIUM | LOW
    primary_process: Optional[str]
    evidence_items:  list[str]    # human-readable evidence bullets
    evidence_strength: dict       # from compute_evidence_strength()
    raw_stats:       dict = field(default_factory=dict)


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

    top_proc  = cpu_ranking[0]["name"] if cpu_ranking else "unknown"
    top_cpu   = cpu_ranking[0].get("avg_value", 0) if cpu_ranking else 0
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
        f"{top_proc} ranked #1 in CPU usage ({top_cpu:.1f}% avg)",
    ]
    if disk_anomaly and disk_anomaly.is_anomaly:
        bullets.append("Disk activity also elevated during the same window")

    return DiagnosisCandidate(
        rule_id="A",
        probable_cause="Sustained CPU contention",
        severity="HIGH",
        primary_process=top_proc,
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

    top_proc = mem_ranking[0]["name"] if mem_ranking else "unknown"
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
    bullets.append(f"{top_proc} ranked #1 in memory usage")

    return DiagnosisCandidate(
        rule_id="B",
        probable_cause=cause,
        severity="HIGH",
        primary_process=top_proc,
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

    top_proc = disk_ranking[0]["name"] if disk_ranking else "unknown"
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
        f"{top_proc} ranked #1 in disk I/O",
    ]

    return DiagnosisCandidate(
        rule_id="C",
        probable_cause="Sustained storage I/O activity",
        severity="MEDIUM",
        primary_process=top_proc,
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
) -> Optional[DiagnosisCandidate]:
    """
    Triggered when a single process shows a persistent positive memory trend.
    IMPORTANT: NOT labelled as a memory leak – labelled as sustained memory growth.
    """
    SLOPE_THRESHOLD  = 0.5   # MB/sample minimum to be interesting
    MIN_SAMPLES      = 20
    slope_mb = memory_slope / (1024 * 1024)

    if slope_mb < SLOPE_THRESHOLD or sample_count < MIN_SAMPLES:
        return None

    ev = compute_evidence_strength(
        zscore=None,
        consecutive_anomalies=sample_count,
        process_ranking=[],
        correlated_metrics_count=0,
        total_monitored_metrics=4,
        trend_slope=slope_mb,
    )

    growth_mb = (current_bytes - baseline_bytes) / (1024 * 1024)

    bullets = [
        f"{process_name} memory growing at {slope_mb:.2f} MB/sample",
        f"Trend observed over {sample_count} samples",
        f"Growth: {growth_mb:.1f} MB from baseline",
        "This indicates sustained memory growth, not a confirmed memory leak.",
    ]

    return DiagnosisCandidate(
        rule_id="E",
        probable_cause=f"Sustained unusual memory growth in {process_name}",
        severity="MEDIUM",
        primary_process=process_name,
        evidence_items=bullets,
        evidence_strength=ev,
        raw_stats={
            "slope_mb_per_sample": slope_mb,
            "sample_count": sample_count,
            "growth_mb": growth_mb,
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
            )
            if c:
                candidates.append(c)

    return candidates

