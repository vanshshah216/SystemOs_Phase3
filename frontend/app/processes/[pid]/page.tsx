"use client";
import { use, useState, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import MetricChart from "@/components/charts/MetricChart";
import { useProcessHistory } from "@/hooks/useProcesses";
import { api } from "@/lib/api";
import { formatPct, formatBytes } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  Clock,
  Activity,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Network,
  Sparkles,
  Terminal,
  TrendingUp,
  HardDrive,
  HelpCircle,
  Layers,
  Zap,
} from "lucide-react";
import type { ProcessProfile, ProcessRecommendation } from "@/types";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "< 1m";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function getClassBadge(activityClass: string) {
  switch (activityClass) {
    case "Active application":
      return {
        bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        dot: "bg-emerald-400",
        label: "Active application",
      };
    case "High resource consumer":
      return {
        bg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        dot: "bg-rose-400",
        label: "High resource consumer",
      };
    case "Review candidate":
      return {
        bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        dot: "bg-amber-400",
        label: "Review candidate",
      };
    case "Protected/system process":
      return {
        bg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        dot: "bg-sky-400",
        label: "Protected/system process",
      };
    case "Insufficient information":
      return {
        bg: "bg-slate-700/30 text-slate-400 border-slate-600/30",
        dot: "bg-slate-500",
        label: "Insufficient info",
      };
    case "Background process":
    default:
      return {
        bg: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        dot: "bg-sky-400",
        label: "Background process",
      };
  }
}

function getSafetyBadge(safetyTier: string) {
  switch (safetyTier) {
    case "protected_system":
      return {
        icon: Shield,
        text: "Protected System",
        className: "text-sky-300 bg-sky-950/40 border-sky-800/40",
      };
    case "review_with_caution":
      return {
        icon: AlertTriangle,
        text: "Review Caution",
        className: "text-amber-300 bg-amber-950/40 border-amber-800/40",
      };
    case "safe_to_review":
      return {
        icon: CheckCircle2,
        text: "Safe to Review",
        className: "text-emerald-300 bg-emerald-950/40 border-emerald-800/40",
      };
    case "uncertain":
    default:
      return {
        icon: AlertCircle,
        text: "Unverified",
        className: "text-slate-400 bg-slate-900 border-slate-700/50",
      };
  }
}

export default function ProcessDetailPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid: pidStr } = use(params);
  const pid = parseInt(pidStr, 10);

  const { history, loading: historyLoading } = useProcessHistory(pid, 3600);
  const [analysis, setAnalysis] = useState<{ profile: ProcessProfile; recommendations: ProcessRecommendation[] } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  useEffect(() => {
    if (!pid) return;
    setAnalysisLoading(true);
    api.getSingleProcessAnalysis(pid)
      .then(res => setAnalysis(res))
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  }, [pid]);

  const profile = analysis?.profile;
  const recommendations = analysis?.recommendations ?? [];
  const latest = history[history.length - 1];

  const displayName = profile?.display_name ?? latest?.display_name ?? profile?.name ?? latest?.name ?? `Process ${pid}`;
  const activityClass = profile?.activity_class ?? "Background process";
  const safetyTier = profile?.safety_tier ?? "safe_to_review";
  const classBadge = getClassBadge(activityClass);
  const safety = getSafetyBadge(safetyTier);
  const SafetyIcon = safety.icon;

  const cpuData = history.map(h => ({ timestamp: h.timestamp, value: h.cpu_percent }));
  const memData = history.map(h => ({ timestamp: h.timestamp, value: h.memory_bytes }));
  const ioData = history.map(h => ({
    timestamp: h.timestamp,
    value: ((h.io_read_bytes || 0) + (h.io_write_bytes || 0)),
  }));

  const cpuVals = cpuData.map(d => d.value || 0);
  const peakCpu = cpuVals.length ? Math.max(...cpuVals) : 0;
  const avgCpu = cpuVals.length ? cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length : 0;

  const memVals = memData.map(d => d.value || 0);
  const peakMem = memVals.length ? Math.max(...memVals) : 0;

  const trends = profile?.trends ?? {};

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
      <TopBar title="Process Telemetry & Profiling" subtitle={displayName} />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        <Link
          href="/processes"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Process Matrix
        </Link>

        {/* ── Process Identity & Classification Hero Deck ─────────────────────── */}
        <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#29323d]">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
                  PROCESS TARGET #{pid}
                </span>

                {/* Activity Classification Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${classBadge.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${classBadge.dot}`} />
                  <span>{classBadge.label}</span>
                </span>

                {/* Safety Level Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${safety.className}`}>
                  <SafetyIcon className="w-3 h-3" />
                  <span>{safety.text}</span>
                </span>

                {profile?.is_foreground && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Active Window Focus
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight flex items-center gap-3">
                <span>{displayName}</span>
              </h2>
              {(profile?.name ?? latest?.name) && displayName !== (profile?.name ?? latest?.name) && (
                <div className="mt-1 text-xs font-mono text-slate-500">
                  Executable: {profile?.name ?? latest?.name}
                </div>
              )}

              {profile?.parent_name && (
                <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Spawned by parent: <strong>{profile.parent_name}</strong> {profile.ppid && `(PID ${profile.ppid})`}
                  </span>
                </div>
              )}
            </div>

            {/* Live Instant Metrics Trio */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#11171f] border border-[#232d38] rounded-lg p-3 text-right">
                <div className="text-[10px] text-slate-500 font-mono uppercase">Instant CPU</div>
                <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
                  {formatPct(profile?.cpu_percent ?? latest?.cpu_percent)}
                </div>
              </div>

              <div className="bg-[#11171f] border border-[#232d38] rounded-lg p-3 text-right">
                <div className="text-[10px] text-slate-500 font-mono uppercase">Resident RAM</div>
                <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
                  {profile?.memory_mb
                    ? `${profile.memory_mb.toFixed(1)} MB`
                    : formatBytes(latest?.memory_bytes)}
                </div>
              </div>

              <div className="bg-[#11171f] border border-[#232d38] rounded-lg p-3 text-right">
                <div className="text-[10px] text-slate-500 font-mono uppercase">Open Sockets</div>
                <div className="text-lg font-bold font-mono text-sky-400 mt-0.5 flex items-center justify-end gap-1">
                  <Network className="w-4 h-4 text-sky-500" />
                  <span>{profile?.open_connections ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-500 text-[11px]">Process Duration</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatDuration(profile?.runtime_seconds ?? 0)}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px]">Active Threads</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">
                {profile?.threads ?? latest?.threads ?? "—"}
              </div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px]">1-Hour CPU Peak</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">{peakCpu.toFixed(1)}%</div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px]">1-Hour Memory Peak</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">{formatBytes(peakMem)}</div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px]">CPU Regression Slope</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">
                {trends.cpu_slope != null ? `${trends.cpu_slope > 0 ? "+" : ""}${trends.cpu_slope.toFixed(2)}/sample` : "—"}
              </div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px]">Memory Growth Trend</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5 capitalize">
                {trends.memory_trend ?? "Stable"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Targeted Recommendations & Evidence (if applicable) ─────────────── */}
        {recommendations.length > 0 && (
          <div className="bg-[#151b23] border border-amber-500/30 rounded-xl p-6 sm:p-7 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#29323d] pb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold font-mono text-slate-100">
                ACTIVE RECOMMENDATION FOR PID {pid}
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {recommendations[0].category.toUpperCase()}
              </span>
            </div>

            {recommendations.map(rec => (
              <div key={rec.id} className="space-y-4 text-xs font-mono">
                <p className="text-slate-300 text-sm leading-relaxed">
                  {rec.what_process_is_doing || rec.activity_description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#11171f] p-3 rounded-lg border border-[#29323d] space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Unusual Pattern Assessment</span>
                    <div className="text-slate-200">{rec.is_usage_unusual}</div>
                  </div>

                  <div className="bg-[#11171f] p-3 rounded-lg border border-[#29323d] space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Classification Justification</span>
                    <div className="text-slate-200">{rec.classification_reason}</div>
                  </div>

                  <div className="bg-[#11171f] p-3 rounded-lg border border-[#29323d] space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Investigation Advice</span>
                    <div className="text-slate-200">{rec.should_investigate || rec.investigation_advice}</div>
                  </div>

                  <div className="bg-[#11171f] p-3 rounded-lg border border-[#29323d] space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Manual Closure Guidance</span>
                    <div className="text-slate-200">{rec.manual_closure_considered || rec.manual_closure_guidance}</div>
                  </div>
                </div>

                <div className="bg-[#11171f] p-3.5 rounded-lg border border-amber-500/20 text-amber-300/90">
                  <strong className="text-amber-400">Safety & Uncertainty Note:</strong> {rec.safety_and_uncertainty}
                </div>

                {rec.evidence && rec.evidence.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      Supporting Evidence
                    </span>
                    <ul className="space-y-1 text-slate-400">
                      {rec.evidence.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Oscilloscope Historical Charts ──────────────────────────────────── */}
        {historyLoading && history.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 font-mono">
            Loading historical process telemetry...
          </div>
        ) : history.length === 0 ? (
          <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-12 text-center text-xs text-slate-500 font-mono">
            No telemetry records discovered for PID {pid} within the active 60-minute window.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wider">
                    CPU Utilization History (%)
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Avg: {avgCpu.toFixed(1)}%</span>
              </div>
              <MetricChart
                data={cpuData}
                color="#38bdf8"
                formatY={v => `${v.toFixed(1)}%`}
                height={240}
              />
            </div>

            <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wider">
                    Resident Memory Footprint
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Peak: {formatBytes(peakMem)}</span>
              </div>
              <MetricChart
                data={memData}
                color="#818cf8"
                formatY={v => formatBytes(v)}
                height={240}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
