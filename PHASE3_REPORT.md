# SYSTEMOS — Phase 3 Final Verification & Architecture Report

**Project:** SYSTEMOS (Statistical Performance Monitoring and Root-Cause Diagnosis)  
**Phase:** Phase 3 Completion & Verification  
**Date:** October 2026  
**Auditor / Engineer:** Senior Systems & Observability Engineer  
**Status:** Verification Complete — Production Ready

---

## 1. System Architecture

SYSTEMOS operates on a transparent, local-first observability pipeline designed to detect anomalies, attribute resource stress to specific processes, and produce explainable diagnostic conclusions without black-box machine learning or automated destructive actions:

```
+---------------------------------------------------------------------------------------------------+
|                                       SYSTEMOS CORE PIPELINE                                      |
+---------------------------------------------------------------------------------------------------+
|  1. Live Telemetry Acquisition (psutil collector thread polling every 3.0 seconds)                |
|     └── System metrics: CPU user/system/total, RAM used/avail/%, Disk read/write, Net in/out      |
|     └── Process snapshots: PID, PPID, name, status, CPU %, RAM bytes/%, Disk I/O, sockets         |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  2. Local Data Persistence (SQLite WAL mode in backend/systemos.db)                               |
|     └── Indexed tables: system_metric, process_snapshot, diagnosis_event, app_settings            |
|     └── 24-hour automatic retention pruning to maintain compact database footprint (~4.7 MB)     |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  3. Mathematical Statistical Engine (app/statistics/engine.py)                                    |
|     └── Rolling history window (300 samples / 15 minutes)                                         |
|     └── Minimum baseline requirement: N >= 10 samples before anomaly evaluation                   |
|     └── Calculates: Mean (μ), Standard Deviation (σ), Z-Score, Percentiles (P50/P90/P95/P99),     |
|         and Linear Regression Trend Slope (m)                                                     |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  4. Anomaly Detection & Persistence Filtering (app/diagnosis/anomaly.py, persistence.py)         |
|     └── Evaluates statistical departure: Z-score >= 2.0σ or value > P95                           |
|     └── Persistence filter: Requires N = 4 consecutive anomalous cycles                          |
|     └── Discards transient spikes (< 4 cycles) to eliminate false positives                       |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  5. Process Attribution (app/diagnosis/attribution.py)                                            |
|     └── Aggregates top resource consumers across the active anomaly window                        |
|     └── Correlates highest CPU, memory footprint, and disk I/O with system-level stress          |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  6. Root-Cause Diagnosis Rules A–E (app/diagnosis/rules.py)                                       |
|     ├── Rule A: Sustained CPU Contention (CPU anomaly + N=4 persistence + top process)            |
|     ├── Rule B: Memory Pressure with Disk Activity (RAM anomaly + N=4 persistence + disk paging)  |
|     ├── Rule C: Disk I/O Bottleneck (Disk read/write surge + N=4 persistence)                     |
|     ├── Rule D: Network-Heavy Workload (Network recv/sent surge + N=4 persistence)                |
|     └── Rule E: Process Memory Growth (Steady memory expansion >= 0.5 MB/sample over >= 20 cycles)|
|     └── Evidence Strength Scoring: Score = 0.30A + 0.25P + 0.20C + 0.15R + 0.10T                  |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  7. Phase 3: Process Activity Classifier & Recommendation Engine (process_analyzer.py)            |
|     ├── Classifies all processes into 6 canonical categories with strict safety rules             |
|     └── Generates 7-dimensional explainable recommendations for human-in-the-loop review          |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  8. REST API Layer (FastAPI on http://localhost:8000)                                             |
|     └── Serves telemetry, process profiles, health, recommendations, and demo controls           |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
|  9. Web Dashboard (Next.js 16.3.5 on http://localhost:3000)                                       |
|     └── Overview, Live Telemetry, Process Analyzer (/processes), Process Detail (/processes/[pid])|
|     └── Explainable Diagnostics (/diagnostics), Events Audit, Settings, and Pipeline Health       |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Working Features Overview

SYSTEMOS provides a complete suite of observability tools:

1. **Live System Telemetry:** Real-time polling and visualization of CPU (normalized per-core), RAM saturation, Disk I/O throughput, and Network ingress/egress.
2. **Deterministic Root-Cause Reasoning:** Explicit rule execution (Rules A–E) that records transparent evidence bullets rather than opaque ML scores.
3. **Cross-Resource Corroboration:** Correlates simultaneous vector anomalies (e.g., memory exhaustion leading to swap file thrashing).
4. **Historical Trend Analysis:** Oscilloscope-style trend lines displaying historical trajectory, P95 reference marks, and anomaly thresholds.
5. **Configurable Detection Parameters:** Dynamic tuning of sampling intervals, rolling window sizes, persistence counters, and Z-score cutoffs.
6. **Built-in Safe Demo Mode:** Injects synthetic scenarios (CPU Stress, Memory Pressure, Disk I/O, Network Load, Memory Growth) directly into the real analysis pipeline without stressing host hardware.
7. **Clean Database Management:** Automated WAL-mode SQLite storage with background pruning to prevent disk bloat.

---

## 3. New Phase 3 Functionality

Phase 3 introduces advanced process intelligence while preserving SYSTEMOS’s core non-destructive design principles:

### A. Process Analyzer Dashboard (`/processes`)
- **Process Activity Grid:** Displays PID, process name, parent hierarchy (`ppid` and `parent_name`), normalized CPU %, memory footprint (MB and %), thread count, and network connection count.
- **6 Canonical Category Filters:** Filter processes by `Active application`, `High resource consumer`, `Background process`, `Protected/system process`, `Review candidate`, and `Insufficient information`.
- **Search & Multi-Column Sorting:** Real-time search by name or PID; instant sorting by CPU %, memory footprint, disk activity, or runtime duration.
- **Recommendations Drawer:** Sliding panel showing estimated reclaimable memory (MB) and actionable review candidates.

### B. Detailed Process Profile View (`/processes/[pid]`)
- **Lineage Tree Tracing:** Displays parent process metadata and Win32 foreground window focus status (`is_foreground`).
- **Trend Charts:** Interactive historical graphs plotting CPU trajectory and memory growth over time.
- **Explainable Analysis Cards:** Displays the full 7-dimensional diagnostic breakdown specific to that PID.

### C. Pipeline Health Component (`/health`)
- Embedded component monitoring the real-time operational health of all 6 monitoring stages:
  1. Telemetry Collector (Daemon state)
  2. Database Storage (WAL mode & snapshot counts)
  3. Statistical Engine (Baseline availability)
  4. Anomaly Detector & Persistence Tracker
  5. Process Analyzer Engine
  6. Diagnosis Rules Engine

### D. Enhanced Diagnostics Anomaly Correlation (`/diagnostics`)
- **Direct Contributor Connection:** Directly links detected bottleneck events (e.g. Memory Pressure) with the specific processes attributed to the stress.
- **Live vs Demo Mode Badge:** Unambiguous visual badge distinguishing live kernel hardware feeds from synthesized simulation runs.

---

## 4. Process Classification Rules

Classification is performed in strict precedence order to prevent miscategorization.

### Canonical Classifications & Precedence Order:

```
[ Incoming Process Profile ]
            │
            ├─► 1. Protected / System Process?
            │      Condition: In OS protected sets (smss, csrss, lsass, System, svchost, etc.) OR PID <= 4
            │      Action: Tag as "Protected/system process" (Safety: protected_system, Closure: NEVER)
            │
            ├─► 2. Insufficient Information?
            │      Condition: Process runtime < 10.0 seconds
            │      Action: Tag as "Insufficient information" (Safety: uncertain, Closure: NEVER)
            │
            ├─► 3. High Resource Consumer?
            │      Condition: CPU >= 15% OR RAM >= 1200 MB OR Disk >= 5 MB/s OR Active Anomaly Attribution
            │      Action: Tag as "High resource consumer" (Safety: review_with_caution)
            │
            ├─► 4. Active Application?
            │      Condition: Holds Win32 foreground focus OR Interactive desktop app with recent activity
            │      Action: Tag as "Active application" (Safety: safe_to_review / caution)
            │
            ├─► 5. Review Candidate? (Evaluated across 4 sub-rules)
            │      Sub-rule 5a (Idle High Memory): RAM >= 600 MB, non-system, non-foreground, CPU < 2%
            │      Sub-rule 5b (Background CPU Drain): Sustained 8% <= CPU < 15%, non-foreground
            │      Sub-rule 5c (Redundant Helper): Known updater/helper in background with RAM >= 150 MB
            │      Sub-rule 5d (Memory Expansion): Trend slope >= 0.5 MB/sample over >= 20 samples
            │      Action: Tag as "Review candidate" (Safety: safe_to_review / review_with_caution)
            │
            └─► 6. Background Process
                   Default: Long-running process with nominal resource usage
                   Action: Tag as "Background process" (Safety: review_with_caution)
```

### Critical Anti-Heuristic Constraints:
1. **Low CPU Usage Alone Is NEVER Disqualifying:** A process with 0% CPU is not considered unnecessary; background services frequently sleep waiting for events.
2. **Unfamiliar Processes Are NEVER Assumed Safe:** Unknown third-party executables are marked `uncertain` with explicit warnings to investigate before considering closure.
3. **Protected Processes Are NEVER Recommended:** Windows core infrastructure processes are excluded from all closure recommendations.

---

## 5. 7-Dimensional Explainable Recommendation Engine

Every recommendation generated by SYSTEMOS provides answers across 7 standardized dimensions:

| Dimension | Description & Purpose | Example Output |
|---|---|---|
| **1. What Process Is Doing** | Explains the operational role of the application. | `"Active background web browser process retaining memory-mapped caches."` |
| **2. Resources Consumed** | Exact metric footprint (CPU %, RAM MB, Disk throughput). | `"Consuming 1,420 MB RAM (8.8% of system memory) with 0.1% CPU load."` |
| **3. Usage Assessment** | Indicates whether current usage is normal, elevated, or anomalous. | `"Memory consumption is significantly higher than typical background state."` |
| **4. Classification Rationale** | Formal rule explanation for why it received its activity label. | `"Classified as Review candidate due to high idle memory retention while out of focus."` |
| **5. Investigation Guidance** | Specific steps for the operator to inspect before taking action. | `"Check open browser tabs or background extensions for unneeded web pages."` |
| **6. Manual Closure Guidance** | Safe human-in-the-loop closure steps (e.g. Save work -> Normal Exit). | `"Consider closing unused tabs or restarting the browser via its normal application menu."` |
| **7. Safety & Uncertainty** | Explicit warnings on dependencies, data loss risks, or unknown binaries. | `"Do not terminate forcefully. Unsaved tab state will be lost if closed abruptly."` |

---

## 6. Testing Evidence Summary

The entire codebase has been verified with 100% test pass rates:

- **Backend Tests (Pytest):** **72 / 72 tests passed** (0 failures, 0 errors in 75.45s)
  - `tests/test_statistics.py`: 16/16 passed
  - `tests/test_diagnosis.py`: 16/16 passed
  - `tests/test_process_analyzer.py`: 29/29 passed
  - `tests/test_pipeline_integration.py`: 11/11 passed
- **Frontend Type Checking:** `npx tsc --noEmit` exited with **0 errors**.
- **Frontend Production Build:** `npm run build` compiled all 11 static and dynamic routes in **1.238 seconds**.
- **AST Safety Verification:** Verified that no `kill()`, `terminate()`, or `os.kill` calls exist anywhere in the backend application code.

---

## 7. Known System Limitations

1. **Windows Platform Optimizations:**
   - On Windows, `psutil.cpu_times().iowait` is not supported by the Windows kernel. SYSTEMOS handles this gracefully by defaulting `cpu_iowait = None`.
   - Foreground window detection uses Win32 `GetForegroundWindow` and `GetWindowThreadProcessId` via Python `ctypes`. In headless or SSH environments, it gracefully returns `None`.
2. **PID Recycling:**
   - Operating systems recycle PIDs over time. Process history graphs query by PID and timestamp range; historical graphs reflect the lifetime of the currently running instance.
3. **Sampling Resolution:**
   - Telemetry is sampled at 3-second intervals by default. Transient micro-spikes lasting under 100 milliseconds are smoothed by the operating system kernel counters.
4. **Non-Destructive Constraint:**
   - SYSTEMOS intentionally does not include an automatic "Kill Process" button. It is strictly an explainable diagnostic advisory system.

---

## 8. Exact Commands to Run SYSTEMOS

### Prerequisites:
- Python 3.10+ (Tested on Python 3.14 on Windows)
- Node.js 18+ and npm

### Terminal 1: Start Backend (FastAPI)

```powershell
# Navigate to the backend directory
cd c:\Users\DELL\Downloads\sovereign-ai-workbench-main\systemos\backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start the FastAPI server with live collector
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
*Backend will be running at:* `http://127.0.0.1:8000` (Swagger docs: `http://127.0.0.1:8000/docs`)

### Terminal 2: Start Frontend (Next.js)

```powershell
# Navigate to the frontend directory
cd c:\Users\DELL\Downloads\sovereign-ai-workbench-main\systemos\frontend

# Start Next.js development server
npm run dev
```
*Frontend will be running at:* `http://localhost:3000`

---

## 9. Step-by-Step Demonstration Sequence for Phase 3 Evaluation

Follow this 5-minute evaluation sequence to review the Phase 3 features:

### Step 1: Open Overview & Verify Pipeline Health
1. Open `http://localhost:3000/overview` in your browser.
2. Observe the live metric cards (CPU, RAM, Disk, Network) updating every ~2.5 seconds.
3. Notice the **Pipeline Health Deck** in the left sidebar indicating that all 6 monitoring components are operational.

### Step 2: Evaluate the Process Analyzer (`/processes`)
1. Click **Processes** in the sidebar or navigate to `http://localhost:3000/processes`.
2. Review the top KPI cards: Total Monitored Processes, Total Memory Tracked, Active Review Candidates, and Estimated Reclaimable Memory.
3. Observe the **Pipeline Health Component** at the top verifying that Collector, Database, Statistics, Anomaly, Process Analyzer, and Diagnosis Rules are online.
4. Test the **Category Tabs**:
   - Click `Active application` to see foreground interactive processes.
   - Click `Protected/system process` to verify OS core services (`smss.exe`, `System`, `services.exe`) are recognized.
   - Click `Review candidate` to see processes flagged for idle high memory or sustained background resource drain.
5. Test **Search & Sorting**:
   - Type in the search box (e.g. `chrome` or `python`).
   - Click the column headers (CPU %, Memory, Disk I/O) to verify sorting.

### Step 3: Inspect a Specific Process Profile (`/processes/[pid]`)
1. In the Process table, click the **Profile** button on any running process (e.g. your browser or code editor).
2. Review the detailed view:
   - Process Identity, PID, PPID, Parent Name, and Win32 Foreground status badge.
   - Live resource consumption cards (CPU, Memory, Disk, Sockets).
   - Oscilloscope trend charts for CPU and Memory history.
   - 7-Dimensional Explainable Recommendations panel.

### Step 4: Test Explainable Diagnostics with Mocked Demo Mode
1. Navigate to `http://localhost:3000/diagnostics`.
2. Notice the `[LIVE TELEMETRY]` badge indicating real kernel hardware data.
3. Scroll down to Section 6 (**Demo Simulation Deck**) and click **SIMULATE MEMORY PRESSURE**.
4. Observe the simulation lifecycle:
   - System fast-injects 35 baseline samples.
   - Memory escalates to 90%+ with concurrent disk paging activity.
   - Persistence filter tracks consecutive cycles (N = 1, 2, 3, 4).
   - Once N=4 is reached, **Rule B (Memory Pressure with Increased Disk Activity)** fires.
5. Look at Section 1 and Section 3 (**Contributing Processes & Recommendations**):
   - Notice the badge updates to `[DEMO SIMULATION DATA]`.
   - The primary contributor (`MemoryEater.exe` / `Chrome [Simulated]`) is highlighted with its exact PID.
   - The 7-dimensional explainability panels provide transparent rationale, investigation advice, and safe human remediation guidance.
6. Click **STOP SIMULATION** in the Demo Deck; the system smoothly returns toward baseline.
