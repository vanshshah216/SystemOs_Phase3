"use client";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import type { SystemMetric, DiagnosisEvent } from "@/types";

interface SystemHealthCardProps {
  metrics: SystemMetric | null | undefined;
  activeEvents: DiagnosisEvent[];
  loading?: boolean;
}

export default function SystemHealthCard({ metrics, activeEvents, loading }: SystemHealthCardProps) {
  const status = metrics?.overall_status ?? "healthy";

  // Dynamic explanation derived directly from active events and metric contexts
  let explanation = "All monitored metrics are within the normal historical range.";

  if (activeEvents.length > 0) {
    const topEvent = activeEvents[0];
    const proc = topEvent.primary_process ? ` (${topEvent.primary_process})` : "";
    explanation = `${topEvent.probable_cause}${proc}. Condition verified by statistical persistence and multi-signal attribution.`;
  } else if (metrics?.ram_context?.is_sustained) {
    explanation = `RAM usage (${metrics.ram_percent?.toFixed(1)}%) is significantly above historical baseline (${metrics.ram_context.mean?.toFixed(1)}%) and has remained elevated for ${metrics.ram_context.consecutive_anomalies ?? 4} consecutive samples.`;
  } else if (metrics?.cpu_context?.is_sustained) {
    explanation = `CPU utilization (${metrics.cpu_percent?.toFixed(1)}%) is significantly above historical baseline (${metrics.cpu_context.mean?.toFixed(1)}%) and has remained elevated for ${metrics.cpu_context.consecutive_anomalies ?? 4} consecutive samples.`;
  } else if (metrics?.disk_read_context?.is_sustained) {
    explanation = `Disk read throughput has remained sustained at elevated rates across consecutive sampling windows.`;
  } else if (metrics?.cpu_context?.is_anomaly) {
    explanation = `Transient CPU variance detected (Z-score: ${metrics.cpu_context.zscore?.toFixed(2)}). Persistence filter tracking consecutive stability.`;
  } else if (metrics?.ram_context?.is_anomaly) {
    explanation = `Transient Memory variance detected (Z-score: ${metrics.ram_context.zscore?.toFixed(2)}). Persistence filter tracking consecutive stability.`;
  }

  const configs = {
    healthy: {
      label: "Healthy",
      icon: CheckCircle2,
      textColor: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-500/5",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    warning: {
      label: "Warning",
      icon: AlertTriangle,
      textColor: "text-amber-400",
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/5",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    critical: {
      label: "Critical",
      icon: XCircle,
      textColor: "text-rose-400",
      borderColor: "border-rose-500/30",
      bgColor: "bg-rose-500/5",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
  };

  const c = configs[status] || configs.healthy;
  const Icon = c.icon;

  return (
    <div className={`bg-[#111726] border ${c.borderColor} rounded-xl p-6 ${c.bgColor} transition-all`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
            <Icon className={`w-6 h-6 ${c.textColor}`} />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                SYSTEM HEALTH
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${c.badge}`}>
                {c.label}
              </span>
            </div>

            <p className="text-sm font-sans text-slate-200 mt-1.5 leading-relaxed max-w-3xl">
              {loading ? "Connecting to real-time system metrics engine..." : explanation}
            </p>
          </div>
        </div>

        {/* Dynamic sample depth tag */}
        <div className="text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 shrink-0 self-start sm:self-center">
          <div className="text-[11px] text-slate-500">Baseline Depth</div>
          <div className="text-slate-300 font-medium">
            {metrics?.baseline_sample_count ?? 0} samples
          </div>
        </div>
      </div>
    </div>
  );
}
