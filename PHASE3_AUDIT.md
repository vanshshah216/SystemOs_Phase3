# SYSTEMOS — Phase 3 Comprehensive Technical Audit & Implementation Plan

**Project:** SYSTEMOS (Statistical Performance Monitoring and Root-Cause Diagnosis)  
**Audit Target:** Architecture, Backend, Frontend, Data Pipeline, Statistical Engine, Diagnosis Rules, and Process Monitoring  
**Auditor:** Senior Full-Stack Observability & Systems Engineer  
**Status:** Audit Complete — Ready for Phase 3 Implementation  
**Date:** October 2026  

---

## 1. Executive Summary

SYSTEMOS was designed as an explainable, local-first system observability tool built on:
```
psutil → Collector → SQLite → Statistical Engine → Anomaly Detector 
→ Persistence Checker → Process Attribution → Diagnosis Rules (A–E) 
→ FastAPI REST API → Next.js Dashboard
```

This audit evaluated the codebase against the requirements for **Phase 3 submission**, which prioritizes:
1. **Intelligent Process Monitoring**: Deep process telemetry and profiling beyond raw instant snapshots.
2. **Resource-Intensive Application Detection**: Identifying sustained resource hogs vs transient spikes.
3. **Process Activity Classification**: Categorizing processes into Active Foreground, Background Service, Idle/Dormant, System Core, and Resource Hog.
4. **Intelligent Recommendations for Reviewing Unnecessary Applications**: Deterministic, explainable guidance on background bloatware and idle high-footprint apps.

### Key Audit Findings
- **Core Pipeline (Phases 1 & 2)**: System-level telemetry collection, statistical engine (mean, std, z-score, percentiles, trend slope), anomaly detection, persistence tracking, and Rules A–D are **fully functional** and verified by **32 passing unit tests**.
- **Critical Defects Identified**:
  1. **Rule E (Process Memory Growth) is Disconnected**: `rule_e_process_memory_growth` exists in `rules.py` and is unit-tested, but is **never evaluated** in `evaluate_rules()` or called in `pipeline.py`.
  2. **Demo Scenario `process_memory_growth` is Broken**: The endpoint `/demo/scenarios` advertises `process_memory_growth`, but the scenario function is not registered in `_SCENARIOS` in `simulator.py`, returning an error on execution.
  3. **SQLite Database Bloat (277 MB)**: `process_snapshot` has accumulated over **3.14 million rows** because every running process is written every 3 seconds with **no retention or pruning policy**.
  4. **Frontend TypeScript Failures**: `npx tsc --noEmit` fails with **19 compilation errors** (primarily strict null checks and `{}` fallback type definitions in diagnosis and live metric pages).
  5. **Leftover Dead Code (Journey 3D Assets)**: A 50+ MB bundle (`journey/` page, 13 Three.js scene components, 30+ texture PNGs, audio file, and heavy dependencies like `three`, `gsap`, `lenis`) is completely unrelated to SYSTEMOS.
- **Phase 3 Capabilities**: Process activity classification and unnecessary application recommendations are **completely missing** and must be developed.

---

## 2. Differentiating Verified Execution vs Code Inspection

| Component | Audit Method | Result / Evidence |
|---|---|---|
| **Statistical Engine (`engine.py`)** | **Executed Test** | 16 tests PASSED (`test_statistics.py`) |
| **Persistence Tracker (`persistence.py`)** | **Executed Test** | 3 tests PASSED (`test_diagnosis.py`) |
| **Rules A–D (`rules.py`)** | **Executed Test** | 10 tests PASSED (`test_diagnosis.py`) |
| **Rule E Unit Logic (`rules.py`)** | **Executed Test** | 2 tests PASSED (`test_diagnosis.py`) |
| **Evidence Formulation (`evidence.py`)** | **Executed Test** | 3 tests PASSED (`test_diagnosis.py`) |
| **Rule E Pipeline Hook** | **Code Inspection** | **DEFECT**: Missing in `evaluate_rules()` in `rules.py` |
| **Demo Scenarios A–D** | **Code Inspection** | Implemented and integrated with pipeline |
| **Demo Scenario E** | **Code Inspection** | **BROKEN**: Missing runner in `_SCENARIOS` in `simulator.py` |
| **Process Collection (`telemetry.py`)** | **Executed / DB Inspect** | 3,144,583 rows present in `process_snapshot` |
| **Frontend TypeScript Build** | **Executed Test** | **19 TS errors** via `npx tsc --noEmit` |
| **Frontend Process Page** | **Code Inspection** | Only basic sorting table; no classification or recommendations |

---

## 3. Evaluation of the 10 Core SYSTEMOS Capabilities

| Capability | Current Status | Findings & Implementation Details |
|---|---|---|
| **1. Live system monitoring** | **Fully Implemented** | `telemetry.py` polls system state every 3s via background daemon thread; frontend polls `/metrics/current` every 2.5s. |
| **2. CPU/RAM/disk/network metrics** | **Fully Implemented** | Full telemetry captured: CPU (user, system, total; iowait null on Windows by design), RAM (used, available, percent), Disk (read/write byte deltas), Network (sent/recv byte deltas). |
| **3. Individual process monitoring** | **Partially Implemented** | `psutil.process_iter` dumps all processes into SQLite `process_snapshot`. Lacks process metadata (cmdline, start time, status, user vs system). |
| **4. Process CPU and memory history** | **Fully Implemented** | `GET /processes/{pid}/history` returns historical telemetry; `/processes/[pid]` visualizes trends via Recharts. (Limitation: PID-specific; resets if process restarts). |
| **5. Statistical anomaly detection** | **Fully Implemented** | In-memory rolling window (300 samples) evaluates z-score > 2.0 and P95 threshold in `engine.py` and `anomaly.py`. |
| **6. Root-cause diagnosis** | **Partially Implemented** | Rules A (CPU), B (Memory), C (Disk), and D (Network) fire and produce explainable `DiagnosisEvent` rows with evidence scores. Rule E is disconnected. |
| **7. Process contribution ranking** | **Fully Implemented** | `attribution.py` aggregates top consumers across event windows via SQL averaging for CPU, RAM, and Disk I/O. |
| **8. Process activity classification** | **Missing (Phase 3)** | **Not implemented**. SYSTEMOS does not classify processes into Active Foreground, Background Service, Idle, System Core, or Resource Hog. |
| **9. Recommendations for reviewing unnecessary applications** | **Missing (Phase 3)** | **Not implemented**. Static event remediation exists in `PreventionAndRecovery.tsx`, but no intelligent engine identifies unnecessary background apps. |
| **10. Dashboard and backend integration** | **Fully Implemented** | REST API (`FastAPI` port 8000) and Next.js frontend (port 3000) communicate smoothly across Overview, Live, Processes, Diagnostics, Events, and Settings. |

---

## 4. File-by-File Source Analysis

### Backend Files (`systemos/backend/`)

| File Path | Role & Purpose | Used? | Dependencies / Dependents | Duplication | Recommendation |
|---|---|---|---|---|---|
| `app/main.py` | FastAPI application factory, lifespan startup/shutdown, CORS, and router registration. | Yes | Imports `database.py`, `telemetry.py`, and routers. | None | **Keep & Improve**: Register new Phase 3 process analyzer router. |
| `app/database.py` | SQLite schema setup, thread-local connections, WAL mode, app settings KV. | Yes | Used by all backend modules. | None | **Keep & Improve**: Add retention pruning function, index `process_snapshot`, add schema for recommendations. |
| `app/collector/telemetry.py` | Background daemon loop collecting psutil telemetry and invoking the analysis pipeline. | Yes | Depended on by `main.py` and `health.py`. | None | **Keep & Improve**: Add process metadata (status, is_system, uptime) for Phase 3 classification. |
| `app/statistics/engine.py` | Pure statistical mathematical functions: mean, std, z-score, percentiles, linear regression slope. | Yes | Used by `anomaly.py`, `pipeline.py`, `metrics.py`. Tested by `test_statistics.py`. | None | **Keep & Reuse**: Core mathematical engine for Phase 3 process baselines and trend analysis. |
| `app/diagnosis/anomaly.py` | Wraps `engine.analyse_metric` into structured dataclass `AnomalyResult`. | Yes | Used by `pipeline.py` and `rules.py`. | None | **Keep**: Reusable as-is. |
| `app/diagnosis/persistence.py` | Tracks consecutive anomaly counts per metric; triggers sustained state when count >= N. | Yes | Used by `pipeline.py`, `rules.py`, `metrics.py`. | None | **Keep & Reuse**: Generalize logic to track sustained process-level resource hogging. |
| `app/diagnosis/attribution.py` | Ranks processes over anomaly time windows from SQLite `process_snapshot`. | Yes | Used by `pipeline.py`. | None | **Keep & Improve**: Adapt aggregation logic for continuous process profiling. |
| `app/diagnosis/rules.py` | Deterministic diagnosis rules A–E and master evaluator `evaluate_rules`. | Yes | Used by `pipeline.py`. Tested by `test_diagnosis.py`. | None | **Keep & Fix**: Connect `rule_e_process_memory_growth` into `evaluate_rules()`. |
| `app/diagnosis/evidence.py` | Calculates composite Evidence Strength score: `0.30A + 0.25P + 0.20C + 0.15R + 0.10T`. | Yes | Used by `rules.py` and `pipeline.py`. | None | **Keep & Reuse**: Extend formula concept for recommendation confidence scores. |
| `app/services/pipeline.py` | Analysis pipeline orchestrator: rolling deques, anomaly checks, persistence, attribution, events. | Yes | Used by `telemetry.py` and `simulator.py`. | None | **Keep & Improve**: Hook Rule E and trigger Process Analyzer. |
| `app/api/metrics.py` | Endpoints: `/metrics/current`, `/metrics/history`, `/metrics/stats/{metric}`. | Yes | Consumed by frontend (`useMetrics.ts`). | None | **Keep**: Stable and working. |
| `app/api/processes.py` | Endpoints: `/processes` (sorted list), `/processes/{pid}/history` (historical time series). | Yes | Consumed by frontend (`useProcesses.ts`). | None | **Keep & Expand**: Add `/processes/analyzer`, `/processes/recommendations`, `/processes/categories`. |
| `app/api/events.py` | Endpoints: `/events`, `/events/{id}`. | Yes | Consumed by frontend (`useEvents.ts`). | None | **Keep**: Stable and working. |
| `app/api/settings.py` | Endpoints: GET/POST `/settings`. | Yes | Consumed by frontend settings page. | None | **Keep**: Stable and working. |
| `app/api/health.py` | Endpoint: `/health` (backend, DB, collector status). | Yes | Consumed by sidebar health deck. | None | **Keep**: Stable and working. |
| `app/api/demo.py` | Endpoints: `/demo/start`, `/demo/stop`, `/demo/status`, `/demo/runs`, `/demo/scenarios`. | Yes | Consumed by `DemoPanel.tsx`. | None | **Keep**: Stable. |
| `app/demo/simulator.py` | Fast synthetic telemetry generator for demo scenarios. | Yes | Used by `api/demo.py`. | None | **Keep & Fix**: Implement missing `_run_process_memory_growth` runner and register in `_SCENARIOS`. |
| `tests/test_statistics.py` | Unit tests for statistical engine (16 tests). | Yes | Pytest runner. | None | **Keep**: All 16 tests pass. |
| `tests/test_diagnosis.py` | Unit tests for persistence, Rules A–E, and evidence scoring (16 tests). | Yes | Pytest runner. | None | **Keep & Expand**: Add test coverage for Phase 3 Process Analyzer and recommendations. |

---

### Frontend Files (`systemos/frontend/`)

| File Path | Role & Purpose | Used? | Dependencies / Dependents | Duplication | Recommendation |
|---|---|---|---|---|---|
| `app/layout.tsx` | Next.js root layout with dark theme fonts and container shell. | Yes | Root wrapper for all pages. | None | **Keep**. |
| `app/page.tsx` | Root redirect to `/overview`. | Yes | Application entry. | None | **Keep**. |
| `app/overview/page.tsx` | Main dashboard (cards, live chart, diagnosis summary, top processes, demo). | Yes | Uses overview components and hooks. | None | **Keep & Fix**: Resolve TypeScript null check errors. |
| `app/live/page.tsx` | Deep-dive real-time charts for CPU, RAM, Disk, Network. | Yes | Uses `MetricChart.tsx` and `useMetrics.ts`. | None | **Keep & Fix**: Resolve TypeScript null check errors. |
| `app/processes/page.tsx` | Process list matrix with sorting tabs (All, CPU, Memory, Disk IO) and search. | Yes | Uses `useProcesses.ts`. | None | **Upgrade for Phase 3**: Transform into the Process Analyzer Dashboard. |
| `app/processes/[pid]/page.tsx` | Detailed telemetry and historical time series for individual PID. | Yes | Uses `MetricChart.tsx` and `useProcessHistory`. | None | **Keep & Improve**: Add process activity badge, lifetime, and resource impact. |
| `app/diagnostics/page.tsx` | Explainable diagnostics view with root-cause breakdown and evidence metrics. | Yes | Uses diagnosis components. | None | **Keep & Fix**: Fix TypeScript `{}` fallback type errors. |
| `app/events/page.tsx` | Historical diagnosis events table with status filtering. | Yes | Uses `useEvents.ts`. | None | **Keep**. |
| `app/events/[id]/page.tsx` | Single diagnosis event inspection with full evidence details. | Yes | Uses `useEvents.ts`. | None | **Keep & Fix**: Fix TypeScript `{}` fallback type errors. |
| `app/settings/page.tsx` | UI for modifying sampling interval, rolling window, z-score threshold, etc. | Yes | Uses `api.getSettings`. | None | **Keep**. |
| `components/layout/Sidebar.tsx` | Main left-hand navigation and real-time service health status deck. | Yes | Present on all pages. | None | **Keep & Improve**: Add Process Analyzer indicator/counter. |
| `components/layout/TopBar.tsx` | Page header with title and breadcrumb subtitle. | Yes | Present on all pages. | None | **Keep**. |
| `components/charts/MetricChart.tsx` | Reusable Recharts component with gradients, reference lines, and tooltips. | Yes | Used across Overview, Live, and Process Detail. | None | **Keep & Reuse**: Reuse for Process Analyzer resource charts. |
| `components/demo/DemoPanel.tsx` | Floating/inline interactive trigger for synthetic simulations. | Yes | Used in Overview and Diagnostics. | None | **Keep**: Works for scenarios A–D. |
| `components/diagnosis/DiagnosisCard.tsx` | Active diagnosis banner with severity and top process. | Yes | Used in Overview and Diagnostics. | None | **Keep & Fix**: Fix TypeScript type error on `evidence`. |
| `components/diagnosis/EvidencePanel.tsx` | Evidence radar/breakdown displaying A, P, C, R, T formula components. | Yes | Used in Diagnostics and Event Detail. | None | **Keep**. |
| `components/diagnosis/PreventionAndRecovery.tsx` | Safety guidelines, prevention tips, and recovery trajectory progress bar. | Yes | Used in Overview and Diagnostics. | None | **Keep**. |
| `lib/api.ts` | Typed client wrappers for all backend REST endpoints. | Yes | Used across all frontend hooks. | None | **Keep & Expand**: Add Phase 3 API methods (`getProcessAnalysis`, `getRecommendations`). |
| `types/index.ts` | Shared TypeScript interfaces matching backend models. | Yes | Imported everywhere in frontend. | None | **Keep & Fix**: Fix `DiagnosisEvent.evidence` type and add Phase 3 types. |
| `hooks/useProcesses.ts` | SWR-style polling hook for process list and PID history. | Yes | Used in processes pages. | None | **Keep & Expand**: Add `useProcessAnalysis` and `useProcessRecommendations`. |
| `hooks/useMetrics.ts` | Polling hook for `/metrics/current`, history, stats, and health. | Yes | Used across Overview, Live, Sidebar. | None | **Keep**. |
| `hooks/useEvents.ts` | Polling hook for `/events`. | Yes | Used in Overview, Diagnostics, Events. | None | **Keep**. |

---

### Unused & Leftover Files Identified (Review for Removal)

The following files were carried over from an external template ("Zero University — The Sovereign Cinematic Journey") and are **completely disconnected** from SYSTEMOS:

1. `frontend/app/journey/page.tsx` (Cinematic 3D journey page)
2. `frontend/components/journey/*` (13 scene components: `BetaModal.tsx`, `BloomTransition.tsx`, `CloudRevealScene.tsx`, `CosmicPortalScene.tsx`, `CreationScene.tsx`, `CrimsonShatterScene.tsx`, `GreenHandScene.tsx`, `HUD.tsx`, `InfoMenuModal.tsx`, `InteractiveCityScene.tsx`, `JourneyCanvas.tsx`, `LandmarkModal.tsx`, `UnderseaScene.tsx`)
3. `frontend/hooks/useJourneyState.ts`, `frontend/lib/animation.ts`, `frontend/lib/sound.ts`
4. `frontend/public/textures/*` (30+ PNG textures, ~50+ MB)
5. `frontend/public/audio.mp3`
6. `package.json` unused dependencies: `three`, `@types/three`, `gsap`, `lenis`, `canvas-confetti`

*Note: In accordance with audit instructions, these files will NOT be deleted now, but are marked for quarantine/cleanup in the implementation phase.*

---

## 5. Phase 3 Reusable Components

The following existing components will be directly reused to build the Phase 3 Process Analyzer:

1. **`app/statistics/engine.py`**:
   - `compute_mean`, `compute_std`, `compute_zscore`: Used to establish individual process resource baselines and detect abnormal resource usage.
   - `compute_trend_slope`: Reused to compute process memory growth slope (fixing Rule E).
2. **`app/diagnosis/persistence.py`**:
   - Persistence state-machine logic: Reused to ensure an application is only flagged as a "Resource Hog" or "Unnecessary Application" if its high usage persists across multiple evaluation cycles.
3. **`app/diagnosis/attribution.py`**:
   - Windowed process aggregation logic: Reused to calculate time-weighted average CPU, RAM, and disk consumption per application.
4. **`app/diagnosis/evidence.py`**:
   - Multi-factor evidence scoring: Adapted to produce explainable recommendation confidence scores (e.g., Duration Factor + Resource Factor + Activity Factor).
5. **`components/charts/MetricChart.tsx`**:
   - Reused directly in the Process Analyzer to graph process resource trajectories.
6. **`frontend/hooks/useProcesses.ts` & `frontend/lib/api.ts`**:
   - Existing polling pattern and API wrapper structure extended cleanly for new endpoints.

---

## 6. Technical Gaps & Deficiencies Requiring Resolution

### Defect 1: SQLite Database Bloat & Lack of Pruning
- **Current State**: 3.14 million rows in `process_snapshot`, database file size is **277 MB**.
- **Root Cause**: `collect_process_snapshots()` saves ~250 processes every 3 seconds with no expiration or cleanup.
- **Phase 3 Fix**:
  - Implement a pruning utility (`prune_old_snapshots(retention_hours=2)`).
  - Add compound indexes: `idx_ps_pid_timestamp ON process_snapshot(pid, timestamp)`.
  - Store lightweight aggregates or retain high-granularity data only for active/top processes.

### Defect 2: Rule E (Process Memory Growth) Disconnected
- **Current State**: `rule_e_process_memory_growth` is fully implemented and unit-tested in `rules.py`, but `evaluate_rules()` in `rules.py` does not invoke it.
- **Phase 3 Fix**: Compute process memory trends over a sliding window of process snapshots and invoke Rule E when sustained slope > threshold.

### Defect 3: Broken Demo Scenario `process_memory_growth`
- **Current State**: Scenario listed in `/demo/scenarios`, but selecting it returns an error because `_SCENARIOS` in `simulator.py` lacks the runner.
- **Phase 3 Fix**: Implement `_run_process_memory_growth()` in `simulator.py`, fast-injecting memory growth telemetry on `Chrome [Simulated]` and registering it in `_SCENARIOS`.

### Defect 4: Frontend TypeScript Compilation Errors (19 Errors)
- **Current State**: `npx tsc --noEmit` fails on `app/diagnostics/page.tsx`, `app/events/[id]/page.tsx`, `app/live/page.tsx`, `components/diagnosis/DiagnosisCard.tsx`, and `components/overview/CurrentDiagnosisSection.tsx`.
- **Root Cause**: `event.evidence ?? {}` leaves properties typed as non-existent on `{}`; array `.reduce()` calls in chart summaries don't handle potential `null` values.
- **Phase 3 Fix**: Ensure `types/index.ts` has proper optional fields and default fallback objects; add explicit null-safe filters before `.reduce()`.

---

## 7. Prioritized Phase 3 Implementation Plan

### Step 1: Database Pruning & Schema Enhancement (Backend)
- Add database maintenance routine in `database.py`:
  - Prune process snapshots older than 2 hours (or demo snapshots older than 30 minutes).
  - Add compound index on `process_snapshot(timestamp, pid)`.
  - Add table `process_recommendation` for caching generated recommendations.
- Priority: **HIGH** (prevents disk explosion and speeds up attribution queries).

### Step 2: Backend Process Analyzer Engine (`backend/app/diagnosis/process_analyzer.py`)
- Create dedicated `ProcessAnalyzer` service:
  - **Process Classification**:
    - `System Core`: OS services (`System`, `Registry`, `smss.exe`, `csrss.exe`, `services.exe`, `svchost.exe`, `lsass.exe`, `explorer.exe`).
    - `Active / Foreground`: Process consuming CPU (> 2%) or actively interacting.
    - `Background Service`: Low/moderate background workers and daemons.
    - `Idle / Dormant`: Resident in memory for > 15 minutes with CPU < 0.2% and no IO.
    - `Resource Hog`: Process exceeding statistical baselines (> 20% CPU sustained, or > 1.5 GB RAM while idle).
  - **Intelligent Recommendations Engine**:
    - **Rule REC-1 (Idle High-Memory App)**: Application using > 500 MB RAM while dormant for >= 10 minutes.
    - **Rule REC-2 (Background CPU Drainer)**: Background non-essential process using > 15% CPU for >= 5 consecutive samples.
    - **Rule REC-3 (Dormant Duplicate / Helper)**: Multiple instances of helper tools (e.g., updaters, crash handlers, dormant clients).
    - **Rule REC-4 (Memory Growth Candidate)**: Hooks into Rule E for steady memory accumulation.
  - **Safety Policy & Guardrails**:
    - Categorize into `Safe to Close`, `Review with Caution`, and `Protected (System)`.
    - **Strict Guarantee**: Never auto-terminate; recommendations and user guidance only.

### Step 3: API Integration (`backend/app/api/processes.py`)
- Expose new endpoints:
  - `GET /processes/analyzer`: Returns process list enriched with classification, activity state, lifetime, and resource intensity scores.
  - `GET /processes/recommendations`: Returns active recommendations with reasoning, potential savings, and safety levels.
  - `GET /processes/categories`: Summary of process counts and resource shares by category.

### Step 4: Fix Existing Pipeline Deficiencies (Backend)
- Hook Rule E into `services/pipeline.py` and `diagnosis/rules.py`.
- Implement `_run_process_memory_growth` in `backend/app/demo/simulator.py`.

### Step 5: Frontend Process Analyzer UI (`frontend/app/processes/`)
- Upgrade `frontend/app/processes/page.tsx`:
  - **Summary Deck**: Cards for Total Monitored, Resource Hogs Detected, Idle Memory Occupied, Potential Savings.
  - **Recommendations Drawer / Section**: Cards showing flagged applications, justification bullets, estimated memory reclaim, and risk badges.
  - **Activity Badges in Table**: Color-coded badges for `System Core`, `Active`, `Background`, `Idle`, `Resource Hog`.
  - **Classification Filters**: Filter table by activity category.
- Enhance `frontend/app/processes/[pid]/page.tsx` with activity classification and impact analysis.

### Step 6: Frontend TypeScript Error Resolution & Type Safety
- Fix all 19 compilation errors in `app/diagnostics/page.tsx`, `app/events/[id]/page.tsx`, `app/live/page.tsx`, `components/diagnosis/DiagnosisCard.tsx`, and `components/overview/LivePerformanceSection.tsx`.
- Add full type definitions for Process Analyzer in `frontend/types/index.ts`.

### Step 7: Testing, Verification & Benchmarking
- Add unit tests in `backend/tests/test_process_analyzer.py`:
  - Classification tests (system vs background vs idle).
  - Recommendation rules tests (idle memory, CPU drainer, safety guards).
- Add endpoint tests for `/processes/analyzer` and `/processes/recommendations`.
- Run full pytest suite (ensure 100% pass rate).
- Run `npx tsc --noEmit` on frontend to verify 0 errors.
- End-to-end verification of live telemetry and demo simulations.

---

## 8. Summary Checklist

- **What Already Works**:
  - Live psutil collection of system metrics (CPU, RAM, Disk, Net).
  - SQLite storage and thread-safe querying.
  - NumPy statistical calculations (mean, std, z-score, percentiles, slope).
  - Anomaly detection and persistence tracking state machine.
  - Rules A, B, C, D diagnosis generation with explainable evidence scoring.
  - Process attribution for event windows.
  - Frontend Overview, Live Metrics, Process detail, Diagnostics, Events, Settings, and Demo controls.
  - 32 existing backend unit tests pass.

- **What Is Incomplete / Defective**:
  - Rule E is defined and tested, but disconnected from `pipeline.py`.
  - Demo scenario `process_memory_growth` is missing its runner in `simulator.py`.
  - SQLite database is accumulating unbounded rows (3.14M rows, 277 MB) due to lack of pruning.
  - Frontend TypeScript compiler fails with 19 errors.

- **What Is Missing (Phase 3 Core)**:
  - Process activity classification (Active, Background, Idle, System Core, Resource Hog).
  - Intelligent application review recommendation engine (high-resource idle apps, background drainers, bloatware).
  - Process Analyzer API endpoints (`/processes/analyzer`, `/processes/recommendations`).
  - Frontend Process Analyzer UI (activity badges, recommendation cards, resource recovery metrics).

- **Which Files Require Changes**:
  - `backend/app/database.py` (pruning & indexing)
  - `backend/app/diagnosis/rules.py` (hook Rule E)
  - `backend/app/services/pipeline.py` (integrate process memory trend & analyzer)
  - `backend/app/demo/simulator.py` (implement Rule E scenario)
  - `backend/app/api/processes.py` (Phase 3 endpoints)
  - `frontend/types/index.ts` (Phase 3 interfaces + fix evidence typing)
  - `frontend/lib/api.ts` (Phase 3 fetch methods)
  - `frontend/hooks/useProcesses.ts` (Phase 3 hooks)
  - `frontend/app/processes/page.tsx` (Process Analyzer UI)
  - `frontend/app/diagnostics/page.tsx`, `app/events/[id]/page.tsx`, `app/live/page.tsx`, `components/diagnosis/DiagnosisCard.tsx` (TypeScript error fixes)
  - *New File*: `backend/app/diagnosis/process_analyzer.py`
  - *New File*: `backend/tests/test_process_analyzer.py`

- **Which Files Are Unused / Candidates for Removal**:
  - `frontend/app/journey/page.tsx`
  - `frontend/components/journey/*` (13 scene files)
  - `frontend/hooks/useJourneyState.ts`, `frontend/lib/animation.ts`, `frontend/lib/sound.ts`
  - `frontend/public/textures/*` and `audio.mp3`
  - Heavy 3D libraries in `package.json` (`three`, `gsap`, `lenis`, `canvas-confetti`)

- **Recommended Implementation Sequence**:
  1. Fix Database retention and add index (`database.py`).
  2. Implement Backend `process_analyzer.py` (classification + recommendations).
  3. Wire Rule E into `pipeline.py` and fix `simulator.py`.
  4. Expose Phase 3 API endpoints in `api/processes.py`.
  5. Fix Frontend TypeScript errors and update `types/index.ts`.
  6. Build Frontend Process Analyzer UI in `app/processes/page.tsx`.
  7. Write and execute backend unit tests (`test_process_analyzer.py`) and verify live integration.
