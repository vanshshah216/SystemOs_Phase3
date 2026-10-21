"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Activity, RefreshCw } from "lucide-react";

interface ComponentHealth {
  name: string;
  status: "operational" | "degraded" | "down" | "initializing" | "stopped";
  details: string;
}

export default function PipelineHealthSection() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const res = await api.getHealth();
      setHealthData(res);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error("Health check error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const components: Record<string, ComponentHealth> = healthData?.pipeline_health?.components ?? {
    telemetry_collector: {
      name: "Live Telemetry Collector",
      status: healthData?.collector_running ? "operational" : "degraded",
      details: "psutil daemon monitoring CPU, RAM, Disk, and Network sockets",
    },
    database_storage: {
      name: "SQLite Observability Store",
      status: healthData?.database_ok ? "operational" : "down",
      details: "WAL mode persistence for time-series snapshots and diagnosis events",
    },
    statistical_engine: {
      name: "Statistical Engine",
      status: "operational",
      details: "Rolling baseline z-score & percentile computation",
    },
    anomaly_detector: {
      name: "Anomaly Detector & Persistence Tracker",
      status: "operational",
      details: "Sustained threshold & trend regression state machines",
    },
    process_analyzer: {
      name: "Process Activity & Recommendation Engine",
      status: "operational",
      details: "6-tier canonical classifier and 7-dimension explainable recommendations",
    },
    diagnosis_rules: {
      name: "Root-Cause Diagnosis Rules (A–E)",
      status: "operational",
      details: "Deterministic multi-resource correlation & attribution",
    },
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "degraded":
      case "initializing":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case "down":
      case "stopped":
      default:
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "degraded":
      case "initializing":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "down":
      case "stopped":
      default:
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    }
  };

  const overallHealthy = healthData?.status === "healthy" || healthData?.backend_status === "ok";

  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wider">
              MONITORING PIPELINE HEALTH
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                overallHealthy
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              {overallHealthy ? "All Systems Operational" : "Degraded"}
            </span>
          </div>
          <p className="text-xs font-sans text-slate-400 mt-1">
            Real-time verification of telemetry collection, SQLite storage, statistical analysis, and classification pipelines.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800/60 hover:bg-slate-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Polled 5s</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(components).map(([key, comp]) => (
          <div
            key={key}
            className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-4 space-y-2 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(comp.status)}
                <span className="text-xs font-bold font-mono text-slate-200 truncate">{comp.name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${getStatusBadge(comp.status)}`}>
                {comp.status}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 leading-relaxed">{comp.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
