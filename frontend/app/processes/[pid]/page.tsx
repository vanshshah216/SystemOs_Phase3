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
        bg: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
        dot: "bg-[#16A34A]",
        label: "Active application",
      };
    case "High resource consumer":
      return {
        bg: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
        dot: "bg-[#2563EB]",
        label: "High resource consumer",
      };
    case "Review candidate":
      return {
        bg: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]",
        dot: "bg-[#D97706]",
        label: "Review candidate",
      };
    case "Protected/system process":
      return {
        bg: "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]",
        dot: "bg-[#7C3AED]",
        label: "Protected system",
      };
    case "Insufficient information":
      return {
        bg: "bg-[#F1F4F8] text-[#667085] border-[#E5EAF1]",
        dot: "bg-[#98A2B3]",
        label: "Insufficient info",
      };
    case "Background process":
    default:
      return {
        bg: "bg-[#F8FAFC] text-[#667085] border-[#E5EAF1]",
        dot: "bg-[#98A2B3]",
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
        className: "text-[#7C3AED] bg-[#F5F3FF] border-[#DDD6FE]",
      };
    case "review_with_caution":
      return {
        icon: AlertTriangle,
        text: "Review Caution",
        className: "text-[#D97706] bg-[#FFFBEB] border-[#FDE68A]",
      };
    case "safe_to_review":
      return {
        icon: CheckCircle2,
        text: "Safe to Review",
        className: "text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]",
      };
    case "uncertain":
    default:
      return {
        icon: AlertCircle,
        text: "Unverified",
        className: "text-[#667085] bg-[#F1F4F8] border-[#E5EAF1]",
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

  const cpuVals = cpuData.map(d => d.value || 0);
  const peakCpu = cpuVals.length ? Math.max(...cpuVals) : 0;
  const avgCpu = cpuVals.length ? cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length : 0;

  const memVals = memData.map(d => d.value || 0);
  const peakMem = memVals.length ? Math.max(...memVals) : 0;

  const trends = profile?.trends ?? {};

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      <TopBar title="Process Telemetry & Profiling" subtitle={displayName} />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8 animate-fade-in-up">
        <Link
          href="/processes"
          className="inline-flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-mono font-bold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Process Matrix
        </Link>

        {/* ── Process Identity & Classification Hero Deck ─────────────────────── */}
        <div className="liquid-glass-card p-6 sm:p-7 space-y-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#EDF0F5]">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                  Process Target #{pid}
                </span>

                {/* Activity Classification Badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${classBadge.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${classBadge.dot}`} />
                  <span>{classBadge.label}</span>
                </span>

                {/* Safety Level Badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${safety.className}`}>
                  <SafetyIcon className="w-3 h-3" />
                  <span>{safety.text}</span>
                </span>

                {profile?.is_foreground && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                    Foreground Focus
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] font-mono tracking-tight flex items-center gap-3">
                <span>{displayName}</span>
              </h2>
              {(profile?.name ?? latest?.name) && displayName !== (profile?.name ?? latest?.name) && (
                <div className="mt-1 text-xs font-mono text-[#98A2B3]">
                  Executable binary: {profile?.name ?? latest?.name}
                </div>
              )}

              {profile?.parent_name && (
                <div className="text-xs text-[#667085] font-mono mt-1.5 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#98A2B3]" />
                  <span>
                    Spawned by parent: <strong className="text-[#172033]">{profile.parent_name}</strong> {profile.ppid && `(PID ${profile.ppid})`}
                  </span>
                </div>
              )}
            </div>

            {/* Live Instant Metrics Trio */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-well p-3.5 text-right">
                <div className="text-[10px] text-[#98A2B3] font-mono uppercase font-bold">Instant CPU</div>
                <div className="text-xl font-extrabold font-mono text-[#2563EB] mt-0.5">
                  {formatPct(profile?.cpu_percent ?? latest?.cpu_percent)}
                </div>
              </div>

              <div className="glass-well p-3.5 text-right">
                <div className="text-[10px] text-[#98A2B3] font-mono uppercase font-bold">Resident RAM</div>
                <div className="text-xl font-extrabold font-mono text-[#7C3AED] mt-0.5">
                  {profile?.memory_mb
                    ? `${profile.memory_mb.toFixed(1)} MB`
                    : formatBytes(latest?.memory_bytes)}
                </div>
              </div>

              <div className="glass-well p-3.5 text-right">
                <div className="text-[10px] text-[#98A2B3] font-mono uppercase font-bold">Open Sockets</div>
                <div className="text-xl font-extrabold font-mono text-[#16A34A] mt-0.5 flex items-center justify-end gap-1">
                  <Network className="w-4 h-4 text-[#16A34A]" />
                  <span>{profile?.open_connections ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div className="glass-well p-3">
              <span className="text-[#98A2B3] text-[11px] font-bold">Process Duration</span>
              <div className="text-sm font-bold text-[#172033] mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#98A2B3]" />
                <span>{formatDuration(profile?.runtime_seconds ?? 0)}</span>
              </div>
            </div>

            <div className="glass-well p-3">
              <span className="text-[#98A2B3] text-[11px] font-bold">Active Threads</span>
              <div className="text-sm font-bold text-[#172033] mt-0.5">
                {profile?.threads ?? latest?.threads ?? "—"}
              </div>
            </div>

            <div className="glass-well p-3">
              <span className="text-[#98A2B3] text-[11px] font-bold">1-Hour CPU Peak</span>
              <div className="text-sm font-bold text-[#2563EB] mt-0.5">{peakCpu.toFixed(1)}%</div>
            </div>

            <div className="glass-well p-3">
              <span className="text-[#98A2B3] text-[11px] font-bold">1-Hour Memory Peak</span>
              <div className="text-sm font-bold text-[#7C3AED] mt-0.5">{formatBytes(peakMem)}</div>
            </div>

            <div className="glass-well p-3">
              <span className="text-[#98A2B3] text-[11px] font-bold">CPU Slope</span>
              <div className="text-sm font-bold text-[#172033] mt-0.5">
                {trends.cpu_slope != null ? `${trends.cpu_slope > 0 ? "+" : ""}${trends.cpu_slope.toFixed(2)}/s` : "—"}
              </div>
            </div>

            <div className="glass-well p-3">
              <span className="text-[#98A2B3] text-[11px] font-bold">Memory Trend</span>
              <div className="text-sm font-bold text-[#172033] mt-0.5 capitalize">
                {trends.memory_trend ?? "Stable"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Targeted Recommendations & Evidence (if applicable) ─────────────── */}
        {recommendations.length > 0 && (
          <div className="liquid-glass-card p-6 sm:p-7 space-y-4 shadow-xs border-[#FDE68A] bg-[#FFFBEB]/40">
            <div className="flex items-center gap-2 border-b border-[#FDE68A]/70 pb-3">
              <Sparkles className="w-5 h-5 text-[#D97706]" />
              <h3 className="text-base font-bold font-mono text-[#172033]">
                ACTIVE RECOMMENDATION FOR PID {pid}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                {recommendations[0].category.toUpperCase()}
              </span>
            </div>

            {recommendations.map(rec => (
              <div key={rec.id} className="space-y-4 text-xs font-mono">
                <p className="text-[#172033] text-sm leading-relaxed font-sans">
                  {rec.what_process_is_doing || rec.activity_description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="glass-well p-3.5 space-y-1">
                    <span className="text-[10px] uppercase text-[#98A2B3] font-bold">Unusual Pattern Assessment</span>
                    <div className="text-[#172033] font-sans">{rec.is_usage_unusual}</div>
                  </div>

                  <div className="glass-well p-3.5 space-y-1">
                    <span className="text-[10px] uppercase text-[#98A2B3] font-bold">Classification Justification</span>
                    <div className="text-[#172033] font-sans">{rec.classification_reason}</div>
                  </div>

                  <div className="glass-well p-3.5 space-y-1">
                    <span className="text-[10px] uppercase text-[#98A2B3] font-bold">Investigation Advice</span>
                    <div className="text-[#172033] font-sans">{rec.should_investigate || rec.investigation_advice}</div>
                  </div>

                  <div className="glass-well p-3.5 space-y-1">
                    <span className="text-[10px] uppercase text-[#98A2B3] font-bold">Manual Closure Guidance</span>
                    <div className="text-[#172033] font-sans">{rec.manual_closure_considered || rec.manual_closure_guidance}</div>
                  </div>
                </div>

                <div className="glass-well p-3.5 border-[#FDE68A] bg-[#FFFBEB]/60 text-[#D97706]">
                  <strong className="text-[#B45309]">Safety & Uncertainty Note:</strong> {rec.safety_and_uncertainty}
                </div>

                {rec.evidence && rec.evidence.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                      Supporting Evidence
                    </span>
                    <ul className="space-y-1 text-[#667085]">
                      {rec.evidence.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
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
          <div className="py-16 text-center text-xs text-[#98A2B3] font-mono">
            Loading historical process telemetry...
          </div>
        ) : history.length === 0 ? (
          <div className="liquid-glass-card p-12 text-center text-xs text-[#98A2B3] font-mono shadow-xs">
            No telemetry records discovered for PID {pid} within the active 60-minute window.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="liquid-glass-card p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#172033] font-mono uppercase tracking-wider">
                    CPU Utilization History (%)
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-[#2563EB]">Avg: {avgCpu.toFixed(1)}%</span>
              </div>
              <MetricChart
                data={cpuData}
                color="#2563EB"
                formatY={v => `${v.toFixed(1)}%`}
                height={240}
              />
            </div>

            <div className="liquid-glass-card p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#F5F3FF] text-[#7C3AED]">
                    <MemoryStick className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#172033] font-mono uppercase tracking-wider">
                    Resident Memory Footprint
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-[#7C3AED]">Peak: {formatBytes(peakMem)}</span>
              </div>
              <MetricChart
                data={memData}
                color="#7C3AED"
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
