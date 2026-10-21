"use client";
import { useCurrentMetrics, useHealth } from "@/hooks/useMetrics";
import { timeAgo } from "@/lib/utils";
import { Activity, Clock, ShieldCheck, AlertTriangle, XCircle, Radio } from "lucide-react";

interface TopBarProps {
  title?: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { data: metrics } = useCurrentMetrics(3000);
  const health = useHealth();

  let status: "healthy" | "warning" | "critical" = "healthy";
  if (!health && !metrics) {
    status = "warning";
  } else if (health && (!health.collector_running || !health.database_ok)) {
    status = health.database_ok ? "warning" : "critical";
  } else if (health?.pipeline_health?.overall_status === "degraded") {
    status = "warning";
  } else if (metrics?.overall_status) {
    status = (metrics.overall_status as "healthy" | "warning" | "critical") || "healthy";
  }

  const statusConfig = {
    healthy: {
      label: "Healthy",
      icon: ShieldCheck,
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    warning: {
      label: health && !health.collector_running ? "Degraded" : "Warning",
      icon: AlertTriangle,
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      dot: "bg-amber-500",
    },
    critical: {
      label: "Critical",
      icon: XCircle,
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      dot: "bg-rose-500",
    },
  }[status] || {
    label: "Healthy",
    icon: ShieldCheck,
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
  };

  const StatusIcon = statusConfig.icon;

  return (
    <header className="h-16 border-b border-[#1e293b] bg-[#0d1322]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
      {/* Page Title or System Identity */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-slate-100 font-sans tracking-tight">
            {title || "System Monitor"}
          </h1>
          {subtitle && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-xs text-slate-400 font-normal">{subtitle}</span>
            </>
          )}
        </div>
      </div>

      {/* Observability Telemetry Readouts */}
      <div className="flex items-center gap-4 text-xs font-mono">
        {/* System Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 uppercase tracking-wider text-[11px] font-sans">
            System Status:
          </span>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold text-xs ${statusConfig.badge}`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        {/* Collector Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
          <Radio className={`w-3.5 h-3.5 ${health?.collector_running ? "text-emerald-400" : "text-rose-400"}`} />
          <span>Collector:</span>
          <span className="text-slate-200 font-medium">
            {health?.collector_running ? "Active" : "Offline"}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        {/* Sampling Interval */}
        <div className="hidden md:flex items-center gap-1.5 text-slate-400">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span>Interval:</span>
          <span className="text-slate-200 font-medium">3.0s</span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden lg:block" />

        {/* Last Updated */}
        <div className="hidden lg:flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Updated:</span>
          <span className="text-slate-200 font-medium">
            {health?.last_collection_time ? timeAgo(health.last_collection_time) : "Just now"}
          </span>
        </div>
      </div>
    </header>
  );
}
