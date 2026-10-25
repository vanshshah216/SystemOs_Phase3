"use client";
import { useState, useMemo } from "react";
import { useMetricHistory, useCurrentMetrics } from "@/hooks/useMetrics";
import MetricChart from "@/components/charts/MetricChart";
import { formatBytes, formatPct, timeRangeToSeconds } from "@/lib/utils";
import type { MetricKey } from "@/types";
import { Activity, Clock, Cpu, MemoryStick, HardDrive, Network } from "lucide-react";
import Tooltip from "@/components/common/Tooltip";

const TABS = [
  { id: "cpu_percent" as MetricKey, label: "CPU Utilization", icon: Cpu, unit: "%", color: "#2563EB", formatY: (v: number) => `${v.toFixed(0)}%` },
  { id: "ram_percent" as MetricKey, label: "Memory (RAM)", icon: MemoryStick, unit: "%", color: "#7C3AED", formatY: (v: number) => `${v.toFixed(0)}%` },
  { id: "disk_read_bytes" as MetricKey, label: "Storage I/O", icon: HardDrive, unit: "/s", color: "#D97706", formatY: (v: number) => `${formatBytes(v)}/s` },
  { id: "network_recv_bytes" as MetricKey, label: "Network Ingress", icon: Network, unit: "/s", color: "#16A34A", formatY: (v: number) => `${formatBytes(v)}/s` },
];

const RANGES = ["5m", "15m", "30m", "1h", "6h", "24h"];

export default function LivePerformanceSection() {
  const [activeTab, setActiveTab] = useState<MetricKey>("cpu_percent");
  const [range, setRange] = useState("15m");

  const rangeSeconds = timeRangeToSeconds(range);
  const { data: history } = useMetricHistory(activeTab, rangeSeconds, 4000);
  const { data: currentMetrics } = useCurrentMetrics(3000);

  const activeDef = TABS.find(t => t.id === activeTab) || TABS[0];

  const ctx = activeTab === "cpu_percent"
    ? currentMetrics?.cpu_context
    : activeTab === "ram_percent"
    ? currentMetrics?.ram_context
    : activeTab === "disk_read_bytes"
    ? currentMetrics?.disk_read_context
    : currentMetrics?.net_context;

  // Calculate statistics in window
  const stats = useMemo(() => {
    const validValues = history.map(h => h.value).filter((v): v is number => v != null);
    if (!validValues.length) return { current: null, avg: null, peak: null };
    const sum = validValues.reduce((a, b) => a + b, 0);
    const avg = sum / validValues.length;
    const peak = Math.max(...validValues);
    const current = validValues[validValues.length - 1];
    return { current, avg, peak };
  }, [history]);

  return (
    <div className="liquid-glass-card p-6 sm:p-7 space-y-5 shadow-xs">
      {/* Header with Title and Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#2563EB]">
              Hardware Telemetry
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#172033] font-sans mt-0.5">
            Live Performance Oscillation
          </h3>
          <p className="text-xs text-[#667085] font-sans mt-0.5">
            Continuous real-time measurements plotted against dynamic mathematical baselines and P95 ceilings.
          </p>
        </div>

        {/* Range Controls */}
        <div className="flex items-center gap-1 bg-[#F1F4F8] p-1 rounded-xl border border-[#E5EAF1] self-start sm:self-center">
          <Clock className="w-3.5 h-3.5 text-[#98A2B3] ml-1.5 mr-0.5" />
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-all duration-200 ${
                range === r
                  ? "bg-white text-[#2563EB] font-bold shadow-xs border border-[#BFDBFE]"
                  : "text-[#667085] hover:text-[#172033]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EDF0F5] pb-3">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition-all duration-200 ${
                active
                  ? "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] font-bold shadow-xs"
                  : "text-[#667085] hover:text-[#172033] hover:bg-[#F8FAFC] border border-transparent"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? "text-[#2563EB]" : "text-[#98A2B3]"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Telemetry Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono glass-well p-3.5">
        <div>
          <span className="text-[#98A2B3] text-[11px]">Current Measurement</span>
          <div className="text-sm font-bold text-[#172033] mt-0.5">
            {stats.current != null ? activeDef.formatY(stats.current) : "—"}
          </div>
        </div>

        <div>
          <span className="text-[#98A2B3] text-[11px]">Rolling Baseline (μ)</span>
          <div className="text-sm font-semibold text-[#667085] mt-0.5">
            {ctx?.mean != null ? activeDef.formatY(ctx.mean) : "Learning"}
          </div>
        </div>

        <div>
          <span className="text-[#98A2B3] text-[11px]">Window Peak (Max)</span>
          <div className="text-sm font-semibold text-[#667085] mt-0.5">
            {stats.peak != null ? activeDef.formatY(stats.peak) : "—"}
          </div>
        </div>

        <div>
          <span className="text-[#98A2B3] text-[11px] flex items-center gap-1">
            Z-Score Deviation <Tooltip term="zscore" explanation="Z-score standard deviation measurement" />
          </span>
          <div
            className={`text-sm font-bold mt-0.5 ${
              Math.abs(ctx?.zscore ?? 0) >= 2 ? "text-[#DC2626]" : "text-[#16A34A]"
            }`}
          >
            {ctx?.zscore != null ? `${ctx.zscore > 0 ? "+" : ""}${ctx.zscore.toFixed(2)}σ` : "—"}
          </div>
        </div>
      </div>

      {/* Large Professional Chart */}
      <div className="pt-2">
        <MetricChart
          data={history}
          color={activeDef.color}
          label={activeDef.label}
          formatY={activeDef.formatY}
          baseline={ctx?.mean ?? undefined}
          anomalyThreshold={ctx?.percentile_95 ?? undefined}
          height={280}
        />
      </div>
    </div>
  );
}
