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
cd systemos\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Root: **http://127.0.0.1:8000**
- Interactive Swagger Docs: **http://127.0.0.1:8000/docs**

### 2. Frontend (Next.js)

```powershell
cd systemos\frontend
npm install
npm run dev
```
- Web Application: **http://localhost:3000**

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Complete 6-component pipeline health check |
| GET | `/metrics/current` | Latest system metrics, status, top processes, and baselines |
| GET | `/metrics/history` | Historical telemetry time-series for charts |
| GET | `/metrics/stats/{metric}` | Full statistical baseline context (mean, std, z-score, percentiles) |
| GET | `/processes` | Current running processes sorted by CPU, RAM, or Disk |
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
5. **Review candidate**: Background or idle processes flagged by rule-based sub-rules (idle high memory $>600\text{ MB}$, background CPU drain $8\text{--}15\%$, redundant update helpers, or steady memory expansion).
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

### Backend Unit & Integration Tests (72 Tests)

```powershell
cd systemos\backend
python -m pytest tests/ -v
```

### Frontend Type Soundness & Build Verification

```powershell
cd systemos\frontend
npx tsc --noEmit
npm run build
```
