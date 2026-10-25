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
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case "degraded":
      case "initializing":
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
      case "down":
      case "stopped":
        return <XCircle className="w-4 h-4 text-rose-600 shrink-0" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "degraded":
      case "initializing":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "down":
      case "stopped":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const overallHealthy =
    healthData?.status === "healthy" &&
    healthData?.pipeline_health?.overall_status === "operational";

  return (
    <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-5 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold font-sans text-[#172033]">
              Monitoring health
            </h3>
            {healthData && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase border ${
                  overallHealthy
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {overallHealthy ? "Operational" : "Degraded"}
              </span>
            )}
          </div>
          <p className="text-xs font-sans text-slate-500 mt-1">
            Current status reported by the monitoring backend.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {healthData && (
            <span className="text-xs text-slate-500 font-mono">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="text-xs text-slate-700 hover:text-slate-900 disabled:opacity-60 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 font-mono font-medium transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh status</span>
          </button>
        </div>
      </div>

      {healthError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-800 shadow-xs">
          Backend health is unavailable: {healthError}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(components).map(([key, comp]) => (
          <div
            key={key}
            className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 space-y-2 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {getStatusIcon(comp.status)}
                <span className="text-xs font-bold font-mono text-slate-900 truncate">{comp.name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase shrink-0 border ${getStatusBadge(comp.status)}`}>
                {comp.status}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-600 leading-relaxed">{comp.details}</p>
          </div>
        ))}
        {!healthData && !healthError && loading && (
          <p className="col-span-full py-6 text-center text-sm text-slate-500 font-mono">
            Checking backend health…
          </p>
        )}
      </div>
    </div>
  );
}
