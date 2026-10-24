"use client";
import { useState, useMemo } from "react";
import { useMetricHistory, useCurrentMetrics } from "@/hooks/useMetrics";
import MetricChart from "@/components/charts/MetricChart";
import { formatBytes, formatPct, timeRangeToSeconds } from "@/lib/utils";
import type { MetricKey } from "@/types";
import { Activity, Clock, Cpu, MemoryStick, HardDrive, Network } from "lucide-react";
import Tooltip from "@/components/common/Tooltip";

const TABS = [
  { id: "cpu_percent" as MetricKey, label: "CPU", icon: Cpu, unit: "%", color: "#38bdf8", formatY: (v: number) => `${v.toFixed(0)}%` },
  { id: "ram_percent" as MetricKey, label: "Memory", icon: MemoryStick, unit: "%", color: "#818cf8", formatY: (v: number) => `${v.toFixed(0)}%` },
  { id: "disk_read_bytes" as MetricKey, label: "Disk", icon: HardDrive, unit: "/s", color: "#f59e0b", formatY: (v: number) => `${formatBytes(v)}/s` },
  { id: "network_recv_bytes" as MetricKey, label: "Network", icon: Network, unit: "/s", color: "#10b981", formatY: (v: number) => `${formatBytes(v)}/s` },
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
    <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 space-y-4">
      {/* Header with Title and Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-slate-200">
            Live Performance
          </h3>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Continuous hardware telemetry plotted with dynamic statistical baseline and threshold bounds.
          </p>
        </div>

        {/* Range Controls */}
        <div className="flex items-center gap-1 bg-[#090e18] p-1 rounded-lg border border-[#29323d]">
          <Clock className="w-3 h-3 text-slate-500 ml-1.5 mr-0.5" />
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                range === r
                  ? "bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex items-center gap-2 border-b border-[#29323d] pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                active
                  ? "bg-slate-800 text-sky-400 border border-slate-700 font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? "text-sky-400" : "text-slate-500"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Telemetry Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-[#11171f] border border-[#232d38] rounded-lg p-3">
        <div>
          <span className="text-slate-500 text-[11px]">Current Value</span>
          <div className="text-sm font-bold text-slate-200 mt-0.5">
            {stats.current != null ? activeDef.formatY(stats.current) : "—"}
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px]">Rolling Baseline Mean</span>
          <div className="text-sm font-semibold text-slate-300 mt-0.5">
            {ctx?.mean != null ? activeDef.formatY(ctx.mean) : "Learning"}
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px]">Window Peak</span>
          <div className="text-sm font-semibold text-slate-300 mt-0.5">
            {stats.peak != null ? activeDef.formatY(stats.peak) : "—"}
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] flex items-center">
            Z-Score Deviation <Tooltip term="zscore" explanation="" />
          </span>
          <div
            className={`text-sm font-bold mt-0.5 ${
              Math.abs(ctx?.zscore ?? 0) >= 2 ? "text-rose-400" : "text-slate-200"
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
