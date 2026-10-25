"use client";
import { Cpu, MemoryStick, HardDrive, Network, type LucideIcon } from "lucide-react";
import type { MetricContext } from "@/types";
import Tooltip from "@/components/common/Tooltip";

interface MetricCardProps {
  label: "CPU" | "RAM" | "DISK" | "NETWORK" | string;
  currentValue: number | null | undefined;
  formattedValue: string;
  unit: string;
  context: MetricContext | null | undefined;
  trend?: "up" | "down" | "flat" | null;
  baselineFormatter?: (val: number) => string;
}

export default function MetricCard({
  label,
  currentValue,
  formattedValue,
  unit,
  context,
  trend,
  baselineFormatter,
}: MetricCardProps) {
  const icons = {
    CPU: Cpu,
    RAM: MemoryStick,
    DISK: HardDrive,
    NETWORK: Network,
  };
  const Icon = (icons as Record<string, LucideIcon>)[label] || Cpu;

  const iconStyles: Record<string, string> = {
    CPU: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
    RAM: "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]",
    DISK: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]",
    NETWORK: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
  };

  const hasBaseline = context?.has_baseline && context.mean != null;
  const mean = context?.mean ?? 0;
  const isAnomaly = context?.is_anomaly;
  const isSustained = context?.is_sustained;
  const zscore = context?.zscore;

  // Determine deviation text
  let deviationText = "Normal range";
  let deviationColor = "text-[#667085]";

  if (hasBaseline && currentValue != null && mean > 0) {
    if (label === "CPU" || label === "RAM") {
      const diff = currentValue - mean;
      const sign = diff >= 0 ? "+" : "";
      deviationText = `${sign}${diff.toFixed(1)}% vs baseline`;
      if (diff > 5 && isSustained) deviationColor = "text-[#DC2626] font-semibold";
      else if (diff > 5 && isAnomaly) deviationColor = "text-[#D97706] font-semibold";
      else if (diff < -5) deviationColor = "text-[#667085]";
    } else {
      const pctChange = ((currentValue - mean) / mean) * 100;
      const sign = pctChange >= 0 ? "+" : "";
      deviationText = `${sign}${pctChange.toFixed(0)}% vs baseline`;
      if (pctChange > 20 && (isSustained || isAnomaly)) deviationColor = "text-[#D97706] font-semibold";
    }
  } else if (!hasBaseline) {
    deviationText = "Calibrating baseline";
  }

  // Determine status label and badge
  let statusLabel = "Healthy";
  let statusBadge = "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]";

  if (isSustained) {
    statusLabel = "Sustained";
    statusBadge = "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]";
  } else if (isAnomaly || (zscore != null && zscore >= 2.0)) {
    statusLabel = "Elevated";
    statusBadge = "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]";
  } else if (!hasBaseline) {
    statusLabel = "Calibrating";
    statusBadge = "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]";
  }

  const baselineDisplay = hasBaseline
    ? baselineFormatter
      ? baselineFormatter(mean)
      : `${mean.toFixed(1)}${unit}`
    : "—";

  return (
    <div className="liquid-glass-card-interactive p-6 flex flex-col justify-between min-h-[175px] shadow-xs">
      {/* Top row: Label & Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${iconStyles[label] || "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]"}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#667085] font-mono">
            {label}
          </span>
        </div>

        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border font-mono shadow-2xs ${statusBadge}`}>
          {statusLabel}
        </span>
      </div>

      {/* Middle row: Large current value + Unit */}
      <div className="flex items-baseline gap-1.5 my-3">
        <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-[#172033]">
          {formattedValue}
        </span>
        {unit && <span className="text-sm font-semibold font-mono text-[#98A2B3]">{unit}</span>}
      </div>

      {/* Bottom section: Baseline & Deviation */}
      <div className="pt-3.5 border-t border-[#EDF0F5] space-y-1.5 text-xs font-mono">
        <div className="flex items-center justify-between text-[#667085]">
          <span className="text-[#98A2B3] flex items-center gap-1">
            Baseline
            <Tooltip term="baseline" explanation="Historical rolling mean" />
          </span>
          <span className="text-[#172033] font-semibold">{baselineDisplay}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#98A2B3] flex items-center gap-1">
            Status
            {zscore != null && <Tooltip term="zscore" explanation="Z-score anomaly measurement" />}
          </span>
          <span className={deviationColor}>
            {deviationText}
            {zscore != null && Math.abs(zscore) >= 1.5 && ` (z=${zscore.toFixed(1)})`}
          </span>
        </div>
      </div>
    </div>
  );
}
