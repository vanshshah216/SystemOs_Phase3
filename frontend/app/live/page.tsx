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
  { key: "cpu_percent",        name: "CPU Utilization",         unit: "%",   icon: Cpu,         color: "#38bdf8", formatY: v => `${v.toFixed(1)}%` },
  { key: "ram_percent",        name: "Memory Saturation (RAM)", unit: "%",   icon: MemoryStick, color: "#818cf8", formatY: v => `${v.toFixed(1)}%` },
  { key: "disk_read_bytes",    name: "Storage Read Throughput", unit: "B/s", icon: HardDrive,   color: "#f59e0b", formatY: v => `${formatBytes(v)}/s` },
  { key: "disk_write_bytes",   name: "Storage Write Throughput",unit: "B/s", icon: HardDrive,   color: "#f97316", formatY: v => `${formatBytes(v)}/s` },
  { key: "network_recv_bytes", name: "Network Ingress Rate",    unit: "B/s", icon: Network,     color: "#10b981", formatY: v => `${formatBytes(v)}/s` },
  { key: "network_sent_bytes", name: "Network Egress Rate",     unit: "B/s", icon: Network,     color: "#06b6d4", formatY: v => `${formatBytes(v)}/s` },
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
  let statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

  if (isSustained) {
    statusText = "Sustained Anomaly";
    statusBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  } else if (isAnomaly) {
    statusText = "Elevated";
    statusBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";
  } else if (!hasBaseline) {
    statusText = "Calibrating";
    statusBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";
  }

  return (
    <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 space-y-4 hover:border-slate-700 transition-colors">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-800 text-sky-400 border border-slate-700">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 font-mono">
              {config.name}
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Telemetry Vector: {config.key}
            </span>
          </div>
        </div>

        <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded border ${statusBadge}`}>
          {statusText}
        </span>
      </div>

      {/* 5 Statistics Strip: Current, Average, Peak, Baseline, Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#11171f] border border-[#232d38] rounded-lg p-3 text-xs font-mono">
        <div>
          <span className="text-slate-500 text-[11px]">Current</span>
          <div className="text-base font-bold text-slate-100 mt-0.5">
            {stats.current != null ? config.formatY(stats.current) : "—"}
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px]">Window Average</span>
          <div className="text-sm font-semibold text-slate-300 mt-0.5">
            {stats.avg != null ? config.formatY(stats.avg) : "—"}
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px]">Window Peak</span>
          <div className="text-sm font-semibold text-slate-300 mt-0.5">
            {stats.peak != null ? config.formatY(stats.peak) : "—"}
          </div>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] flex items-center">
            Baseline Mean <Tooltip term="baseline" explanation="" />
          </span>
          <div className="text-sm font-semibold text-slate-300 mt-0.5">
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
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
      <TopBar title="Live Metrics" subtitle="Multi-Channel Telemetry" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
              Live metrics
            </h2>
            <p className="text-sm text-slate-400 font-sans mt-1">
              High-frequency system performance and historical baselines across all monitored vectors.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#090e18] p-1 rounded-lg border border-[#29323d] self-start sm:self-center">
            <Clock className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
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
