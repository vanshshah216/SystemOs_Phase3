"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/types";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Activity, RefreshCw } from "lucide-react";

interface ComponentHealth {
  name: string;
  status: "operational" | "degraded" | "down" | "initializing" | "stopped" | "unknown";
  details: string;
}

export default function PipelineHealthSection() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [healthError, setHealthError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const fetchHealth = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    try {
      const res = await api.getHealth();
      setHealthData(res);
      setHealthError(null);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error("Health check error", e);
      setHealthError(e instanceof Error ? e.message : "Unable to retrieve backend health.");
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  };

  useEffect(() => {
    const initialFetch = setTimeout(() => void fetchHealth(), 0);
    const interval = setInterval(fetchHealth, 5000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, []);

  const components: Record<string, ComponentHealth> = healthData?.pipeline_health?.components ?? (healthData ? {
    telemetry_collector: {
      name: "Live Telemetry Collector",
      status: healthData?.collector_running ? "operational" : "degraded",
      details: "Collects CPU, memory, disk, and network telemetry.",
    },
    database_storage: {
      name: "SQLite Observability Store",
      status: healthData?.database_ok ? "operational" : "down",
      details: "Stores monitoring snapshots and diagnosis events.",
    },
    statistical_engine: {
      name: "Statistical Engine",
      status: "unknown",
      details: "Status is not reported by the backend.",
    },
    anomaly_detector: {
      name: "Anomaly Detector & Persistence Tracker",
      status: "unknown",
      details: "Status is not reported by the backend.",
    },
    process_analyzer: {
      name: "Process Activity & Recommendation Engine",
      status: "unknown",
      details: "Status is not reported by the backend.",
    },
    diagnosis_rules: {
      name: "Root-Cause Diagnosis Rules (A–E)",
      status: "unknown",
      details: "Status is not reported by the backend.",
    },
  } : {});

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />;
      case "degraded":
      case "initializing":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case "down":
      case "stopped":
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-slate-500/10 text-slate-300 border-slate-700";
      case "degraded":
      case "initializing":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "down":
      case "stopped":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const overallHealthy =
    healthData?.status === "healthy" &&
    healthData?.pipeline_health?.overall_status === "operational";

  return (
    <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#29323d] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold font-sans text-slate-100">
              Monitoring health
            </h3>
            {healthData && <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                overallHealthy
                  ? "bg-slate-500/10 text-slate-300 border-slate-700"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              {overallHealthy ? "Operational" : "Degraded"}
            </span>}
          </div>
          <p className="text-xs font-sans text-slate-400 mt-1">
            Current status reported by the monitoring backend.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {healthData && (
            <span className="text-xs text-slate-500">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-60 flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800/60 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh status</span>
          </button>
        </div>
      </div>

      {healthError && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          Backend health is unavailable: {healthError}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(components).map(([key, comp]) => (
          <div
            key={key}
            className="bg-[#11171f] border border-[#232d38] rounded-lg p-4 space-y-2 hover:border-slate-700 transition-colors"
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
        {!healthData && !healthError && loading && (
          <p className="col-span-full py-4 text-center text-sm text-slate-400">
            Checking backend health…
          </p>
        )}
      </div>
    </div>
  );
}
