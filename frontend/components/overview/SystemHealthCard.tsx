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
  let explanation = "All monitored metrics are within normal historical baseline limits.";

  if (activeEvents.length > 0) {
    const topEvent = activeEvents[0];
    const proc = topEvent.primary_process ? ` (${topEvent.primary_process})` : "";
    explanation = `${topEvent.probable_cause}${proc}. Condition verified by statistical persistence and multi-signal attribution.`;
  } else if (metrics?.ram_context?.is_sustained) {
    explanation = `RAM usage (${metrics.ram_percent?.toFixed(1)}%) is elevated above baseline (${metrics.ram_context.mean?.toFixed(1)}%) for ${metrics.ram_context.consecutive_anomalies ?? 4} consecutive samples.`;
  } else if (metrics?.cpu_context?.is_sustained) {
    explanation = `CPU utilization (${metrics.cpu_percent?.toFixed(1)}%) is elevated above baseline (${metrics.cpu_context.mean?.toFixed(1)}%) for ${metrics.cpu_context.consecutive_anomalies ?? 4} consecutive samples.`;
  } else if (metrics?.disk_read_context?.is_sustained) {
    explanation = `Disk read throughput has remained sustained at elevated rates across consecutive sampling windows.`;
  } else if (metrics?.cpu_context?.is_anomaly) {
    explanation = `Transient CPU variance detected (Z-score: ${metrics.cpu_context.zscore?.toFixed(2)}). Persistence debounce filter tracking consecutive stability.`;
  } else if (metrics?.ram_context?.is_anomaly) {
    explanation = `Transient Memory variance detected (Z-score: ${metrics.ram_context.zscore?.toFixed(2)}). Persistence debounce filter tracking consecutive stability.`;
  }

  const configs = {
    healthy: {
      label: "Healthy",
      icon: CheckCircle2,
      textColor: "text-[#16A34A]",
      borderColor: "border-[#BBF7D0]",
      bgColor: "bg-[#F0FDF4]/60",
      badge: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
    },
    warning: {
      label: "Warning",
      icon: AlertTriangle,
      textColor: "text-[#D97706]",
      borderColor: "border-[#FDE68A]",
      bgColor: "bg-[#FFFBEB]/70",
      badge: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]",
    },
    critical: {
      label: "Critical",
      icon: XCircle,
      textColor: "text-[#DC2626]",
      borderColor: "border-[#FECACA]",
      bgColor: "bg-[#FEF2F2]/80",
      badge: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
    },
  };

  const c = configs[status] || configs.healthy;
  const Icon = c.icon;

  return (
    <div className={`liquid-glass-card p-6 border ${c.borderColor} ${c.bgColor} shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300`}>
      <div className="flex items-start gap-3.5">
        <div className={`p-2.5 rounded-xl border ${c.borderColor} bg-white shadow-2xs shrink-0 mt-0.5`}>
          <Icon className={`w-5 h-5 ${c.textColor}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172033] font-mono">
              System State
            </h3>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border font-mono ${c.badge}`}>
              {c.label}
            </span>
          </div>
          <p className="text-xs text-[#667085] mt-1 max-w-3xl leading-relaxed">
            {explanation}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <span className="text-[11px] font-mono text-[#98A2B3]">
          Persistence: N={metrics?.persistence_n ?? 4}
        </span>
      </div>
    </div>
  );
}
