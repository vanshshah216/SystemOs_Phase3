# SYSTEMOS – Statistical Performance Monitoring and Root-Cause Diagnosis

A complete end-to-end, local-first system observability tool that monitors host performance, builds statistical baselines, detects sustained anomalies, identifies contributing processes, classifies process activity, and produces transparent rule-based diagnoses and explainable human-in-the-loop recommendations.

---

## Architecture

```
psutil → Collector → SQLite (WAL) → Statistical Engine → Anomaly Detector
→ Persistence Checker → Process Attribution → Diagnosis Rules (A–E)
→ Process Activity Classifier & Recommendation Engine
→ FastAPI REST API → Next.js Dashboard
```

---

## Project Structure

```
systemos/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry, starts collector & lifecycle
│   │   ├── database.py          # SQLite init, thread-local connections, retention pruning
│   │   ├── collector/
│   │   │   └── telemetry.py     # Background psutil polling loop (3s interval)
│   │   ├── statistics/
│   │   │   └── engine.py        # mean, std, z-score, percentiles, trend slope
│   │   ├── diagnosis/
│   │   │   ├── anomaly.py       # per-metric statistical anomaly detection
│   │   │   ├── persistence.py   # consecutive-sample state machine (N=4 debounce)
│   │   │   ├── attribution.py   # process ranking by resource contribution
│   │   │   ├── rules.py         # explicit diagnosis rules A–E
│   │   │   ├── evidence.py      # composite scoring: 0.30A + 0.25P + 0.20C + 0.15R + 0.10T
│   │   │   └── process_analyzer.py # 6-tier classification & 7-dim recommendations
│   │   ├── api/                 # FastAPI endpoint routers (metrics, processes, events, demo, health, settings)
│   │   ├── services/
│   │   │   └── pipeline.py      # full analysis pipeline orchestrator
│   │   └── demo/
│   │       └── simulator.py     # synthetic telemetry for Demo Mode (Scenarios A–E)
│   ├── tests/                   # 72 pytest unit & integration tests
│   │   ├── test_statistics.py
│   │   ├── test_diagnosis.py
│   │   ├── test_process_analyzer.py
│   │   └── test_pipeline_integration.py
│   └── requirements.txt
└── frontend/
    ├── app/                     # Next.js App Router (Overview, Live, Processes, Diagnostics, Events, Settings)
    ├── components/              # UI components (charts, health, demo deck, diagnosis cards)
    ├── hooks/                   # Polling hooks (useMetrics, useProcesses, useEvents)
    ├── lib/                     # API client & utilities
    └── types/                   # TypeScript interfaces matching backend models
```

---

## Quick Start

### 1. Backend (FastAPI)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Root: **http://127.0.0.1:8000**
- Interactive Swagger Docs: **http://127.0.0.1:8000/docs**

If PowerShell blocks environment activation, run
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then activate again.
The backend starts the collector automatically; leave this terminal running.

### 2. Frontend (Next.js)

In a second PowerShell terminal, from the repository root:

```powershell
cd frontend
npm install
npm run dev
```
- Web Application: **http://localhost:3000**

### Windows collection, names, and measurement notes

- The collector targets the configured interval (three seconds by default) and enumerates accessible PIDs with `psutil`. On Windows, per-process metadata calls can make a full sample take longer than the target; the backend logs a warning with the measured duration. The UI retains a recent sample for up to 60 seconds while collection runs, then marks it stale. Manual refresh allows up to 60 seconds for a full scan.
- Each completed collection assigns one shared timestamp to its system metrics and process snapshot. Application groups, top-process metrics, and event attribution use that same saved snapshot rather than a separate UI-time sample.
- Per-process CPU is sampled as a delta over time and normalized across logical CPU cores (each process uses a 0–100% scale; aggregate application CPU can exceed 100% when its processes use multiple cores). System CPU is the host-wide percentage reported by `psutil`.
- RAM is resident memory (RSS); memory percentage is relative to physical memory. Disk and network system measurements are actual counter deltas divided by elapsed sample time and displayed in bytes per second. Per-process I/O counters may be unavailable without suitable Windows access.
- User-facing process labels prefer recognized application/package names (including Microsoft Store, Visual Studio Code, browsers, and Paint), executable version metadata, and known process relationships. In detailed process views the executable name and PID remain available as technical identifiers. If identity cannot be established confidently, the UI marks the entry as unidentified rather than guessing an application.
- The foreground window is an additional indicator, not a running-process filter. Minimized and background applications remain in the list. Access-denied or short-lived processes may be absent from a snapshot; SYSTEMOS does not require administrator privileges and does not terminate processes.
- The monitor's own Python/uvicorn or Next.js processes are labeled as SYSTEMOS Monitor when their command and working directory identify this checkout. Other developer tools are not excluded merely because they use Python or Node.
- AppX package names depend on Windows Start menu/package metadata and may not resolve for protected or unavailable packages. In that case the process name is shown instead of a guessed product name.
- Statistical alerts require the configured persistence count. A process with the largest measured resource value is reported only as a suspected association, not proof of causation. A process memory increase is recorded only as a low-severity observation after at least 20 samples over 15 minutes, 256 MB net growth, an average rise of at least 1 MB/minute, and increases between at least 60% of consecutive samples. It is not a diagnosis of a leak or slowdown, and does not recommend closing or restarting the app. The observation window is retained in memory by the running collector; it starts over when the backend restarts.
- Event History also records newly detected application starts separately from diagnostic incidents. It establishes a baseline on collector startup, then records an app once when it appears between successful snapshots; it does not backfill apps that were already running or claim an exact OS launch time. A short-lived app that exits between slow Windows scans may not be observed.
- Browser tab titles are available through the optional unpacked extension in `browser-extension/`. Install it from `edge://extensions` or `chrome://extensions` using **Load unpacked** and select that folder. The extension needs the browser's `tabs` permission, reports existing tabs when installed/browser-started, and records new, selected, and retitled tabs. It sends only the browser name, tab title, and activity type to `127.0.0.1:8000`; it does not transmit URLs or page content. Tab titles can themselves contain private information, so enable the extension only if you want them in the local Event History.
- SYSTEMOS can list and search browser-tab activity, but Windows/Chromium do not expose trustworthy per-tab CPU or memory through this integration. Resource data remains aggregated at browser/process level; no tab-specific performance diagnosis is inferred. The extension works only while the local backend is running and is not currently bundled or auto-installed.
- Processes includes conservative idle-use review suggestions after one hour without an eligible user app being observed in the foreground. This is based on periodic foreground-window samples, not keyboard/mouse interaction or proof that an app is unused; tracking begins when the collector observes an app in the foreground. Suggestions only include recognized user apps still present in a fresh process snapshot. SYSTEMOS does not close applications automatically.
- The Processes view's grouped application table reflects all accessible processes in the current snapshot. The separate explainable classification/recommendation panel is intentionally capped to the highest-ranked 120 process profiles to keep the dashboard responsive.

### Manual Windows verification

After both services are running:

1. Open **http://localhost:3000/processes** and confirm the snapshot timestamp advances and the process/application table is populated.
2. Open Microsoft Edge, Microsoft Store, and Visual Studio Code in turn. Wait for the next collector sample (up to the configured interval), then search the application table by display name or executable. Expand an entry to verify its PIDs and process names.
3. Leave an app open while minimizing it; verify it stays listed and is marked as background when it is not the foreground window. Close it and confirm its live group disappears after the next snapshot.
4. Compare browser process count and aggregate RSS/CPU with the expanded process members. Each PID should appear once in the group.
5. Use **Refresh** in the top bar and verify the displayed snapshot timestamp updates without reloading the page. Stop the backend and verify pages show an API/collector error instead of current-looking metrics.
6. Event history should contain only detector-generated events in live mode. A condition must meet the configured anomaly and persistence thresholds; resolving it should retain the event with a resolved status and end timestamp.
7. Keep a recognized user app running, let the collector observe it in the foreground, then leave it out of the foreground for at least one hour. Confirm it appears in **Idle-use review suggestions** while still running. This is a prompt for manual review, not proof the app is unused.
8. To verify the memory-trend observation, leave the backend running and let a process accumulate real RSS measurements for at least 15 minutes. An observation is eligible only after 20 samples, at least 256 MB net growth, at least 1 MB/minute average growth, and a rising sample ratio of 60% or more. Ordinary smaller/shorter increases should not create an event; an emitted record should be LOW severity and should not advise closing or restarting the app.
9. To record browser-tab activity, load `browser-extension/` as an unpacked extension in Edge or Chrome while the backend is running. Open, select, or navigate a tab and confirm its title appears in Event History under **Browser tabs**. Confirm the event detail identifies the browser and activity, and does not claim per-tab CPU or memory.

Windows process/package behavior, Microsoft Store availability, and access restrictions depend on the local Windows installation and must be verified on that host; these scenarios are not asserted by the cross-platform automated tests.

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Complete 6-component pipeline health check |
| GET | `/metrics/current` | Latest system metrics, status, top processes, and baselines |
| GET | `/metrics/history` | Historical telemetry time-series for charts |
| GET | `/metrics/stats/{metric}` | Full statistical baseline context (mean, std, z-score, percentiles) |
| GET | `/processes` | Current running processes sorted by CPU, RAM, or Disk |
| GET | `/applications` | Grouped live applications and one-hour idle-use review suggestions |
| GET | `/processes/analyzer` | Process Analyzer matrix with 6 canonical activity categories |
| GET | `/processes/recommendations` | Explainable recommendations for reviewing unnecessary applications |
| GET | `/processes/categories` | Summary counts and resource aggregation per category |
| GET | `/processes/{pid}/analysis` | Deep telemetry profile & specific recommendations for a PID |
| GET | `/processes/{pid}/history` | Historical CPU and memory trajectory for a specific PID |
| GET | `/events` | Audit trail of historical diagnosis events |
| GET | `/events/{id}` | Full diagnosis event record with evidence items and score |
| GET/POST | `/settings` | Retrieve or dynamically update detection thresholds |
| GET | `/demo/scenarios` | List available synthetic demo scenarios (A–E) |
| POST | `/demo/start` | Start synthetic simulation run |
| POST | `/demo/stop` | Terminate running simulation and return to baseline |
| GET | `/demo/status` | Current simulation stage and detection progress |

---

## Phase 3 Process Intelligence

SYSTEMOS classifies all running processes into **6 canonical activity categories** in strict precedence order:
1. **Protected/system process**: Core OS infrastructure (`smss.exe`, `csrss.exe`, `System`, `services.exe`, etc.). Excluded from closure recommendations.
2. **Insufficient information**: Newly created processes ($t < 10\text{s}$) lacking telemetry depth. Never recommended for closure.
3. **High resource consumer**: Processes consuming elevated resources (CPU $\ge 15\%$, RAM $\ge 1200\text{ MB}$, Disk $\ge 5\text{ MB/s}$, or attributed to an active anomaly).
4. **Active application**: Interactive applications holding foreground focus or user window state.
5. **Review candidate**: Background or idle processes flagged by rule-based sub-rules (idle high memory, background CPU drain, or redundant update helpers). A memory increase alone does not change a process into a review candidate.
6. **Background process**: Normal long-running daemons with nominal resource consumption.

### Strict Anti-Heuristic Guarantees:
- **Low CPU alone is NEVER used to flag a process as unnecessary.**
- **Unfamiliar processes are NEVER assumed safe to terminate.**
- **Zero Automated Process Termination:** SYSTEMOS provides transparent advisory guidance for human operator review and will never kill a process autonomously.

### 7-Dimensional Explainable Recommendations:
Every recommendation details:
1. What the process is doing
2. Which resources it consumes
3. Whether usage is unusual
4. Why it was classified this way
5. Whether the user should investigate it
6. Whether normal manual application closure could be considered
7. Any uncertainty or safety concerns

---

## Evidence Strength Formula

```
Evidence Strength = 0.30A + 0.25P + 0.20C + 0.15R + 0.10T

A = Anomaly Strength     (Z-score normalized 0 → 1)
P = Persistence          (Consecutive samples / 20)
C = Process Contribution (Top process proportional share)
R = Cross-Resource       (Fraction of monitored metrics correlated)
T = Trend Strength       (Normalized rate of metric ascent)
```

---

## Running the Automated Test Suite

### Backend Unit & Integration Tests

```powershell
cd backend
python -m pytest tests -v
```

### Frontend Type Soundness & Build Verification

```powershell
cd systemos\frontend
npx tsc --noEmit
npm run build
```
