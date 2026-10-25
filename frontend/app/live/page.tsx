"use client";
import { useState, useMemo } from "react";
import TopBar from "@/components/layout/TopBar";
import MetricChart from "@/components/charts/MetricChart";
import { useMetricHistory, useCurrentMetrics } from "@/hooks/useMetrics";
import { formatBytes, timeRangeToSeconds } from "@/lib/utils";
import type { MetricKey } from "@/types";
import { Clock, Cpu, MemoryStick, HardDrive, Network, type LucideIcon } from "lucide-react";
import Tooltip from "@/components/common/Tooltip";

const TIME_RANGES = ["5m", "15m", "30m", "1h", "6h", "24h"];

interface MetricConfig {
  key: MetricKey;
  name: string;
  unit: string;
  icon: LucideIcon;
  color: string;
  formatY: (v: number) => string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: "cpu_percent",        name: "CPU Utilization",         unit: "%",   icon: Cpu,         color: "#2563EB", formatY: v => `${v.toFixed(1)}%` },
  { key: "ram_percent",        name: "Memory Saturation (RAM)", unit: "%",   icon: MemoryStick, color: "#7C3AED", formatY: v => `${v.toFixed(1)}%` },
  { key: "disk_read_bytes",    name: "Storage Read Throughput", unit: "B/s", icon: HardDrive,   color: "#D97706", formatY: v => `${formatBytes(v)}/s` },
  { key: "disk_write_bytes",   name: "Storage Write Throughput",unit: "B/s", icon: HardDrive,   color: "#EA580C", formatY: v => `${formatBytes(v)}/s` },
  { key: "network_recv_bytes", name: "Network Ingress Rate",    unit: "B/s", icon: Network,     color: "#16A34A", formatY: v => `${formatBytes(v)}/s` },
  { key: "network_sent_bytes", name: "Network Egress Rate",     unit: "B/s", icon: Network,     color: "#0891B2", formatY: v => `${formatBytes(v)}/s` },
];

function MetricSectionCard({ config, rangeSeconds }: { config: MetricConfig; rangeSeconds: number }) {
  const { data: history, error: historyError } = useMetricHistory(config.key, rangeSeconds, 4000);
  const { data: currentMetrics } = useCurrentMetrics(3000);

  const Icon = config.icon;

  const ctx = config.key === "cpu_percent"
    ? currentMetrics?.cpu_context
    : config.key === "ram_percent"
    ? currentMetrics?.ram_context
    : config.key === "disk_read_bytes"
    ? currentMetrics?.disk_read_context
    : currentMetrics?.net_context;

  // Window statistics
  const stats = useMemo(() => {
    const validVals = history.map(h => h.value).filter((v): v is number => v != null);
    if (!validVals.length) return { current: null, avg: null, peak: null };
    const current = validVals[validVals.length - 1];
    const avg = validVals.reduce((a, b) => a + b, 0) / validVals.length;
    const peak = Math.max(...validVals);
    return { current, avg, peak };
  }, [history]);

  const hasBaseline = ctx?.has_baseline && ctx.mean != null;
  const isSustained = ctx?.is_sustained;
  const isAnomaly = ctx?.is_anomaly;

  let statusText = "Healthy";
  let statusBadge = "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]";

  if (isSustained) {
    statusText = "Sustained Anomaly";
    statusBadge = "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]";
  } else if (isAnomaly) {
    statusText = "Elevated";
    statusBadge = "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]";
  } else if (!hasBaseline) {
    statusText = "Calibrating";
    statusBadge = "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]";
  }

  return (
    <div className="liquid-glass-card-interactive p-6 space-y-4 shadow-xs">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#172033] font-mono">
              {config.name}
            </h3>
            <span className="text-[11px] text-[#98A2B3] font-mono">
              Vector: {config.key}
            </span>
          </div>
        </div>

        <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border shadow-2xs ${statusBadge}`}>
          {statusText}
        </span>
      </div>

      {/* 4 Statistics Strip: Current, Average, Peak, Baseline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 glass-well p-3 text-xs font-mono">
        <div>
          <span className="text-[#98A2B3] text-[11px]">Current</span>
          <div className="text-base font-bold text-[#172033] mt-0.5">
            {stats.current != null ? config.formatY(stats.current) : "—"}
          </div>
        </div>

        <div>
          <span className="text-[#98A2B3] text-[11px]">Window Average</span>
          <div className="text-sm font-semibold text-[#667085] mt-0.5">
            {stats.avg != null ? config.formatY(stats.avg) : "—"}
          </div>
        </div>

        <div>
          <span className="text-[#98A2B3] text-[11px]">Window Peak</span>
          <div className="text-sm font-semibold text-[#667085] mt-0.5">
            {stats.peak != null ? config.formatY(stats.peak) : "—"}
          </div>
        </div>

        <div>
          <span className="text-[#98A2B3] text-[11px] flex items-center gap-1">
            Baseline Mean <Tooltip term="baseline" explanation="Historical calibrated baseline mean" />
          </span>
          <div className="text-sm font-semibold text-[#667085] mt-0.5">
            {hasBaseline && ctx?.mean != null ? config.formatY(ctx.mean) : "Learning"}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="pt-2">
        <MetricChart
          data={history}
          color={config.color}
          label={config.name}
          formatY={config.formatY}
          error={historyError}
          baseline={ctx?.mean ?? undefined}
          anomalyThreshold={ctx?.percentile_95 ?? undefined}
          height={220}
        />
      </div>
    </div>
  );
}

export default function LiveMetricsPage() {
  const [range, setRange] = useState("15m");
  const rangeSeconds = timeRangeToSeconds(range);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      <TopBar title="Live Metrics" subtitle="Multi-Channel Telemetry Oscillation" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8 animate-fade-in-up">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-xs font-mono font-bold tracking-wider text-[#2563EB] uppercase">
                Real-Time Feeds
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033] font-sans">
              Live System Telemetry
            </h2>
            <p className="text-sm text-[#667085] font-sans mt-1">
              High-frequency operating system performance curves and baseline references across all monitored vectors.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#F1F4F8] p-1 rounded-xl border border-[#E5EAF1] self-start sm:self-center shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#98A2B3] ml-2 mr-1" />
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-mono rounded-lg transition-all duration-200 ${
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

        {/* 6 Large Metric Sections in 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {METRIC_CONFIGS.map(config => (
            <MetricSectionCard key={config.key} config={config} rangeSeconds={rangeSeconds} />
          ))}
        </div>
      </main>
    </div>
  );
}
