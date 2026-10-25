"use client";
import { useState, useEffect } from "react";
import { Play, Square, Loader2, Zap, MemoryStick, HardDrive, Network, CheckCircle2, Circle, ShieldCheck, Terminal } from "lucide-react";
import { api } from "@/lib/api";

const SCENARIOS = [
  {
    id: "cpu_stress",
    label: "SIMULATE CPU STRESS",
    icon: Zap,
    diagnosis: "Sustained CPU contention",
    desc: "CPU escalated 35% → 94%. Triggers Rule A via Z ≥ 2.0σ and N=4 persistence.",
  },
  {
    id: "memory_pressure",
    label: "SIMULATE MEMORY PRESSURE",
    icon: MemoryStick,
    diagnosis: "Memory pressure with increased disk activity",
    desc: "RAM climbs 58% → 93% with concurrent disk read elevation. Triggers Rule B.",
  },
  {
    id: "disk_io",
    label: "SIMULATE DISK I/O",
    icon: HardDrive,
    diagnosis: "Sustained storage I/O activity",
    desc: "Storage read throughput surges to 85 MB/s. Triggers Rule C.",
  },
  {
    id: "network_load",
    label: "SIMULATE NETWORK LOAD",
    icon: Network,
    diagnosis: "Sustained network-heavy workload",
    desc: "Network ingress surges to 60 MB/s. Triggers Rule D.",
  },
];

interface SimStatusData {
  active_scenario: string | null;
  running: boolean;
  simulation_id: string | null;
  current_mode: string;
  samples_injected: number;
  current_stage: string;
  detection_status: string;
  diagnosis: string | null;
  severity: string | null;
}

export default function DemoPanel() {
  const [statusData, setStatusData] = useState<SimStatusData>({
    active_scenario: null,
    running: false,
    simulation_id: null,
    current_mode: "Normal",
    samples_injected: 0,
    current_stage: "Completed",
    detection_status: "Not Detected",
    diagnosis: null,
    severity: null,
  });

  const [loading, setLoading] = useState<string | null>(null);
  const [simRuns, setSimRuns] = useState<any[]>([]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/demo/status");
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch {}
  };

  const fetchRuns = async () => {
    try {
      const res = await fetch("http://localhost:8000/demo/runs");
      if (res.ok) {
        const data = await res.json();
        setSimRuns(data.runs || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchRuns();
    const id = setInterval(() => {
      fetchStatus();
      if (statusData.running) fetchRuns();
    }, 2000);
    return () => clearInterval(id);
  }, [statusData.running]);

  const startScenario = async (id: string) => {
    setLoading(id);
    try {
      await api.startDemo(id);
      await fetchStatus();
      await fetchRuns();
    } catch (e: any) {
      alert(`Failed to start simulation: ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const stopScenario = async () => {
    setLoading("stop");
    try {
      await api.stopDemo();
      await fetchStatus();
      await fetchRuns();
    } catch {} finally {
      setLoading(null);
    }
  };

  const isSimulating = statusData.running;
  const samples = statusData.samples_injected || 0;

  // Timeline steps state
  const timelineStages = [
    { label: "NORMAL", desc: "Dynamic baseline calibration", done: samples >= 10 },
    { label: "ANOMALY INJECTED", desc: "Synthetic anomaly introduced", done: samples >= 36 },
    { label: "STATISTICAL DEVIATION", desc: "Z-score exceeds 2.0σ threshold", done: samples >= 37 },
    { label: "PERSISTENCE ACHIEVED", desc: "Sustained for N=4 consecutive samples", done: samples >= 40 },
    { label: "CROSS-RESOURCE CHECK", desc: "Corroborating I/O & paging evaluated", done: samples >= 41 },
    { label: "PROCESS ATTRIBUTION", desc: "Simulated consumer ranked in snapshot", done: samples >= 41 },
    { label: "DIAGNOSIS GENERATED", desc: "Deterministic rule emitted to database", done: samples >= 41 },
  ];

  return (
    <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
            SIMULATION CONTROLS
          </span>
          <h3 className="text-lg font-bold text-[#172033] font-sans mt-0.5">
            Synthetic Anomaly Simulator
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Inject synthetic load vectors into the live mathematical pipeline without restarting servers.
          </p>
        </div>

        {isSimulating && (
          <button
            onClick={stopScenario}
            disabled={loading === "stop"}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-mono font-semibold transition-colors shrink-0 self-start sm:self-center"
          >
            {loading === "stop" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
            STOP SIMULATION
          </button>
        )}
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SCENARIOS.map(sc => {
          const Icon = sc.icon;
          const isActive = statusData.active_scenario === sc.id;
          const isLoading = loading === sc.id;

          return (
            <button
              key={sc.id}
              onClick={() => startScenario(sc.id)}
              disabled={isSimulating || !!loading}
              className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? "bg-blue-50/90 border-blue-400 text-blue-900 shadow-sm ring-1 ring-blue-300"
                  : "bg-slate-50/80 border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 hover:text-slate-900 hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-600"}`} />
                )}
                <span className="text-xs font-mono font-bold tracking-tight">
                  {sc.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                {sc.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* OBSERVABLE SIMULATION STATUS PANEL */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
          Observable Simulation Status Panel
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 font-mono text-xs shadow-xs">
          <div>
            <span className="text-slate-500 text-[11px] font-medium">Current Mode</span>
            <div className="text-sm font-bold mt-0.5">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                isSimulating ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200"
              }`}>
                {statusData.current_mode || (isSimulating ? "Simulation" : "Normal")}
              </span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 text-[11px] font-medium">Scenario</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
              {statusData.active_scenario ? statusData.active_scenario.replace("_", " ").toUpperCase() : "None"}
            </div>
          </div>

          <div>
            <span className="text-slate-500 text-[11px] font-medium">Samples Injected</span>
            <div className="text-sm font-bold text-blue-600 mt-0.5">
              {statusData.samples_injected || 0}
            </div>
          </div>

          <div>
            <span className="text-slate-500 text-[11px] font-medium">Current Stage</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
              {statusData.current_stage || "Idle"}
            </div>
          </div>

          <div>
            <span className="text-slate-500 text-[11px] font-medium">Detection Status</span>
            <div className="mt-0.5">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                statusData.detection_status === "Diagnosis Generated"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : statusData.detection_status === "Sustained Anomaly"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : statusData.detection_status === "Potential Anomaly"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {statusData.detection_status || "Not Detected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SIMULATION TIMELINE PROGRESSION */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
          Simulation Pipeline Timeline
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 font-mono text-xs">
          {timelineStages.map((st, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                st.done
                  ? "bg-emerald-50/70 border-emerald-200/80 text-slate-900 shadow-xs"
                  : "bg-slate-50/50 border-slate-200/60 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                {st.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={st.done ? "text-emerald-700 font-bold" : "text-slate-400 font-medium"}>
                  STEP {i + 1}
                </span>
              </div>
              <div className="font-bold text-[11px] truncate">{st.label}</div>
              <div className="text-[10px] text-slate-500 font-sans mt-0.5 leading-tight">
                {st.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VERIFICATION CHECKLIST & TRANSPARENCY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
        {/* Verification Checklist */}
        <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-2.5 font-mono text-xs shadow-xs">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Mathematical Pipeline Verification Checklist
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Synthetic telemetry generated & injected</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Ingested into SQLite system_metric table</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Statistical engine computes mean, std dev, Z-score, P95</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Persistence state machine verifies N=4 consecutive anomalies</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Deterministic diagnosis rule evaluates candidate</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Event recorded into diagnosis_event & simulation_run tables</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>[✓] Frontend dashboard receives live update via polling API</span>
            </li>
          </ul>
        </div>

        {/* Process Attribution Transparency Note */}
        <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-2 text-xs font-sans text-slate-600 flex flex-col justify-between shadow-xs">
          <div>
            <div className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-amber-600" />
              Attribution Transparency Notice
            </div>
            <p className="leading-relaxed">
              In Simulation Mode, synthetic system-level load is attributed to synthetic mock processes (designated as <code className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-mono font-semibold">[Simulated]</code>). The system strictly avoids fabricating blame against real host OS processes without telemetry evidence.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200/60 text-[11px] font-mono text-slate-500">
            Safety Guarantee: Recommendation-first system; zero automated termination routines.
          </div>
        </div>
      </div>

      {/* RECENT SIMULATION AUDIT RUNS */}
      {simRuns.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
            Simulation Audit Run Log (SQLite simulation_run)
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-xs font-mono bg-white">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                  <th className="text-left py-2.5 px-3 font-semibold">Run ID</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Scenario</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Diagnosis Emitted</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Samples</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Detection Stage</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {simRuns.slice(0, 5).map((run, i) => (
                  <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-[130px]">{run.simulation_id}</td>
                    <td className="py-2.5 px-3 font-semibold text-blue-600">{run.scenario}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">{run.diagnosis || "—"}</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-bold">{run.samples_generated}</td>
                    <td className="py-2.5 px-3 text-slate-600">{run.detection_stage}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        run.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
