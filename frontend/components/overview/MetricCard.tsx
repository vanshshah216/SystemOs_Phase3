"use client";
import { Cpu, MemoryStick, HardDrive, Network } from "lucide-react";
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
  const Icon = (icons as any)[label] || Cpu;

  const hasBaseline = context?.has_baseline && context.mean != null;
  const mean = context?.mean ?? 0;
  const isAnomaly = context?.is_anomaly;
  const isSustained = context?.is_sustained;
  const zscore = context?.zscore;

  // Determine deviation text
  let deviationText = "Normal range";
  let deviationColor = "text-slate-400";

  if (hasBaseline && currentValue != null && mean > 0) {
    if (label === "CPU" || label === "RAM") {
      const diff = currentValue - mean;
      const sign = diff >= 0 ? "+" : "";
      deviationText = `${sign}${diff.toFixed(1)}% from baseline`;
      if (diff > 5 && isSustained) deviationColor = "text-rose-400 font-semibold";
      else if (diff > 5 && isAnomaly) deviationColor = "text-amber-400 font-semibold";
      else if (diff < -5) deviationColor = "text-slate-400";
    } else {
      const pctChange = ((currentValue - mean) / mean) * 100;
      const sign = pctChange >= 0 ? "+" : "";
      deviationText = `${sign}${pctChange.toFixed(0)}% from baseline`;
      if (pctChange > 20 && (isSustained || isAnomaly)) deviationColor = "text-amber-400 font-semibold";
    }
  } else if (!hasBaseline) {
    deviationText = "Calibrating baseline";
  }

  // Determine status label and badge
  let statusLabel = "Healthy";
  let statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

  if (isSustained) {
    statusLabel = "Sustained";
    statusBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  } else if (isAnomaly || (zscore != null && zscore >= 2.0)) {
    statusLabel = "Elevated";
    statusBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";
  } else if (!hasBaseline) {
    statusLabel = "Learning";
    statusBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";
  }

  const baselineDisplay = hasBaseline
    ? baselineFormatter
      ? baselineFormatter(mean)
      : `${mean.toFixed(1)}${unit}`
    : "—";

  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 flex flex-col justify-between min-h-[175px] hover:border-slate-700 transition-colors shadow-sm">
      {/* Top row: Label & Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-800/80 text-sky-400 border border-slate-700/60">
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            {label}
          </span>
        </div>

        <span className={`text-xs font-medium px-2.5 py-1 rounded-md border font-mono ${statusBadge}`}>
          {statusLabel}
        </span>
      </div>

      {/* Middle row: Large current value + Unit */}
      <div className="flex items-baseline gap-2 my-2">
        <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-slate-100">
          {formattedValue}
        </span>
        {unit && <span className="text-sm font-medium font-mono text-slate-500">{unit}</span>}
      </div>

      {/* Bottom section: Baseline & Deviation */}
      <div className="pt-3.5 border-t border-[#1e293b] space-y-1.5 text-xs font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center text-slate-500 text-xs font-sans">
            Baseline <Tooltip term="baseline" explanation="" />
          </span>
          <span className="text-slate-300 font-semibold">{baselineDisplay}</span>
        </div>

        <div className="flex items-center justify-between gap-1">
          <span className="text-slate-500 text-[11px] font-sans shrink-0">Deviation</span>
          <span className={`font-mono text-[11px] text-right truncate ${deviationColor}`}>
            {deviationText}
          </span>
        </div>
      </div>
    </div>
  );
}
