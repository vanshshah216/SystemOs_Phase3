"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
      badge: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
      dot: "bg-[#16A34A]",
    },
    warning: {
      label: collectorOffline ? "Offline" : "Warning",
      badge: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]",
      dot: "bg-[#D97706]",
    },
    critical: {
      label: "Critical",
      badge: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
      dot: "bg-[#DC2626]",
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
    <header className="min-h-16 border-b border-[#E5EAF1] bg-white/85 backdrop-blur-xl px-5 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 sticky top-0 z-20 shrink-0 shadow-xs">
      <div className="flex items-center gap-3">
        <Link href="/overview" className="sm:hidden shrink-0" title="SystemOS Home">
          <img
            src="/systemos-logo.png"
            alt="SystemOS logo"
            className="systemos-logo h-7 w-7 object-contain shrink-0"
          />
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h1 className="text-lg font-bold text-[#172033] font-sans tracking-tight">
            {title || "System Monitor"}
          </h1>
          {subtitle && (
            <span className="text-xs text-[#667085] font-medium">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 text-xs">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5EAF1] bg-white hover:bg-[#F8FAFC] text-[#172033] shadow-xs hover:border-[#BFDBFE] disabled:opacity-50 transition-all duration-200 active:scale-[0.98] font-medium"
          title="Collect fresh telemetry now"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        {refreshError && (
          <span className="hidden lg:inline max-w-48 truncate text-[#DC2626] font-medium" title={refreshError}>
            Refresh failed
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-semibold text-xs shadow-xs ${statusConfig.badge}`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.dot} animate-pulse`} />
            {!health && !collectorOffline ? "Checking" : statusConfig.label}
          </span>
        </div>

        <div className="h-4 w-px bg-[#E5EAF1] hidden sm:block" />

        <div className="hidden md:flex items-center gap-1.5 text-[#667085]">
          <Radio className={`w-3.5 h-3.5 ${!collectorOffline ? "text-[#16A34A]" : "text-[#D97706]"}`} />
          <span className="text-[#172033] font-medium">
            {!health && !collectorOffline ? "Checking" : !collectorOffline ? "Active" : "Unavailable"}
          </span>
        </div>

        <div className="h-4 w-px bg-[#E5EAF1] hidden md:block" />

        <div className="hidden lg:flex items-center gap-1.5 text-[#667085]">
          <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Every {intervalSec}s</span>
        </div>

        <div className="h-4 w-px bg-[#E5EAF1] hidden lg:block" />

        <div className="hidden xl:flex items-center gap-1.5 text-[#667085]">
          <Clock className="w-3.5 h-3.5 text-[#98A2B3]" />
          <span className="text-[#172033] font-medium">
            {updatedTs ? timeAgo(updatedTs) : "—"}
          </span>
        </div>
      </div>
    </header>
  );
}
