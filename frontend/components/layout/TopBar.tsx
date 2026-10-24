"use client";
import { useEffect, useState } from "react";
import { useCurrentMetrics, useHealth } from "@/hooks/useMetrics";
import { usePollingSettings } from "@/hooks/usePollingSettings";
import { timeAgo } from "@/lib/utils";
import { Activity, Clock, Radio, RefreshCw } from "lucide-react";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onRefreshComplete?: () => void;
}

export default function TopBar({ title, subtitle, onRefreshComplete }: TopBarProps) {
  const [clock, setClock] = useState(0);
  const { pollMs, settings, backendOffline, refreshAll, lastRefresh, refreshError } = usePollingSettings();
  const { data: metrics, error: metricsError } = useCurrentMetrics(pollMs);
  const { health, error: healthError } = useHealth(Math.max(pollMs, 5000));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const healthAgeSeconds = health?.last_collection_time == null
    ? null
    : Math.max(0, (clock || health.last_collection_time * 1000) / 1000 - health.last_collection_time);
  const collectorOffline = health
    ? !health.collector_running ||
      !health.database_ok ||
      health.last_collection_time == null ||
      (healthAgeSeconds != null && healthAgeSeconds > Math.max(60, pollMs / 1000 * 5))
    : backendOffline || !!healthError || !!metricsError;

  let status: "healthy" | "warning" | "critical" = "healthy";
  if (collectorOffline) {
    status = health && !health.database_ok ? "critical" : "warning";
  } else if (health?.pipeline_health?.overall_status === "degraded") {
    status = "warning";
  } else if (metrics?.overall_status) {
    status = (metrics.overall_status as "healthy" | "warning" | "critical") || "healthy";
  }

  const statusConfig = {
    healthy: {
      label: "Operational",
      badge: "bg-slate-500/10 text-slate-300 border-slate-700",
      dot: "bg-emerald-400",
    },
    warning: {
      label: collectorOffline ? "Offline" : "Warning",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      dot: "bg-amber-500",
    },
    critical: {
      label: "Critical",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      dot: "bg-rose-500",
    },
  }[status];

  const intervalSec = settings?.sampling_interval ?? "3";
  const updateCandidates = [
    lastRefresh,
    health?.last_collection_time,
    metrics?.timestamp,
  ].filter((value): value is number => typeof value === "number");
  const updatedTs = updateCandidates.length ? Math.max(...updateCandidates) : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshAll();
      if (result) onRefreshComplete?.();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="min-h-16 border-b border-[#29323d] bg-[#11171f]/95 px-5 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 sticky top-0 z-20 shrink-0">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h1 className="text-lg font-semibold text-slate-100 font-sans tracking-tight">
            {title || "System Monitor"}
          </h1>
          {subtitle && (
            <span className="text-xs text-slate-400 font-normal">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 text-xs">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#303a46] bg-[#171e28] hover:bg-[#202833] text-slate-200 disabled:opacity-50 transition-colors"
          title="Collect fresh telemetry now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        {refreshError && (
          <span className="hidden lg:inline max-w-48 truncate text-amber-300" title={refreshError}>
            Refresh failed
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border font-medium text-xs ${statusConfig.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {!health && !collectorOffline ? "Checking" : statusConfig.label}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        <div className="hidden md:flex items-center gap-1.5 text-slate-400">
          <Radio className={`w-3.5 h-3.5 ${!collectorOffline ? "text-slate-500" : "text-amber-400"}`} />
          <span className="text-slate-300">
            {!health && !collectorOffline ? "Checking" : !collectorOffline ? "Active" : "Unavailable"}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        <div className="hidden lg:flex items-center gap-1.5 text-slate-400">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span>Every {intervalSec}s</span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden lg:block" />

        <div className="hidden xl:flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-300">
            {updatedTs ? timeAgo(updatedTs) : "—"}
          </span>
        </div>
      </div>
    </header>
  );
}
