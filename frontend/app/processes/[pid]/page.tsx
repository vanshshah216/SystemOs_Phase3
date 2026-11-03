"use client";
import { use, useState, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import MetricChart from "@/components/charts/MetricChart";
import { useProcessHistory } from "@/hooks/useProcesses";
import { api } from "@/lib/api";
import { formatPct, formatBytes } from "@/lib/utils";
import { getProcessDisplayName, hideExecutableNames } from "@/lib/processNames";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Network,
  Sparkles,
  Terminal,
} from "lucide-react";
import type { ProcessRecommendation, SingleProcessAnalysisResponse } from "@/types";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "< 1m";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function getRecommendationTitle(recommendation: ProcessRecommendation): string {
  switch (recommendation.category) {
    case "idle_high_memory":
      return "Using a lot of memory while idle";
    case "background_cpu_drain":
      return "Using a lot of processing power in the background";
    case "active_diagnosis":
      return "Related to a system warning";
    case "redundant_helper":
      return "Background helper using system resources";
    default:
      return "Review this app's resource use";
  }
}

function getRecommendationAction(
  recommendation: ProcessRecommendation,
  displayName: string,
): string {
  const isBrowser = /chrome|edge|firefox|brave|opera/i.test(displayName);
  if (isBrowser && recommendation.category === "idle_high_memory") {
    return `If you're finished with some pages in ${displayName}, save any work first, then close tabs you no longer need from the browser's tab bar. This may reduce memory use. SYSTEMOS can't close tabs for you.`;
  }
  if (isBrowser && recommendation.category === "background_cpu_drain") {
    return `Check ${displayName} for a video, call, download, or page doing work in the background. Pause it or close tabs you're finished with, after saving any work. SYSTEMOS can't close tabs for you.`;
  }
  if (recommendation.category === "active_diagnosis") {
    return "Open the related system warning and review its measured details. Avoid closing this app until you understand what the warning is reporting.";
  }
  if (recommendation.safety_tier === "protected_system") {
    return "Leave this Windows task running. Do not try to close or end it.";
  }
  return `If you recognize ${displayName} and no longer need it, save your work and close it normally from its own menu. Don't use Force quit or End task based on this suggestion alone.`;
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
  const [analysisState, setAnalysisState] = useState<{
    pid: number;
    result: SingleProcessAnalysisResponse | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!pid) return;
    let active = true;
    api.getSingleProcessAnalysis(pid)
      .then(result => {
        if (active) setAnalysisState({ pid, result, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setAnalysisState({
            pid,
            result: null,
            error: error instanceof Error ? error.message : "Process analysis request failed",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [pid]);

  const currentAnalysis = analysisState?.pid === pid ? analysisState : null;
  const analysisLoading = currentAnalysis === null;
  const profile = currentAnalysis?.result?.profile;
  const recommendations = currentAnalysis?.result?.recommendations ?? [];
  const analysisError = currentAnalysis?.error;
  const latest = history[history.length - 1];

  const displayName = getProcessDisplayName(
    profile?.display_name ?? latest?.display_name,
    profile?.name ?? latest?.name,
  );
  const activityClass = profile?.activity_class ?? "Insufficient information";
  const safetyTier = profile?.safety_tier ?? "uncertain";
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
              {profile?.parent_name && (
                <div className="text-xs text-[#667085] font-mono mt-1.5 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#98A2B3]" />
                  <span>
                    Spawned by parent: <strong className="text-[#172033]">{getProcessDisplayName(profile.parent_name)}</strong> {profile.ppid && `(PID ${profile.ppid})`}
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

        <section className="liquid-glass-card p-6 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#EDF0F5] pb-3">
            <Sparkles className="w-5 h-5 text-[#2563EB]" />
            <div>
              <h3 className="text-base font-bold text-[#172033]">Live assessment & guidance</h3>
              <p className="text-xs text-[#667085] mt-0.5">Based on this process profile and its measured telemetry.</p>
            </div>
          </div>

          {analysisLoading ? (
            <p className="text-sm text-[#667085]" role="status">Loading the current process diagnosis…</p>
          ) : analysisError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
              <strong>Process analysis is unavailable.</strong> {analysisError}
              <p className="mt-1 text-xs">Confirm the process is still running and that the backend is available, then reopen this inspection.</p>
            </div>
          ) : profile ? (
            <>
              <div className={`rounded-xl border p-4 ${
                recommendations.length > 0
                  ? "border-amber-200 bg-amber-50/70"
                  : profile.activity_class === "Protected/system process" || profile.activity_class === "Insufficient information"
                  ? "border-slate-200 bg-slate-50"
                  : "border-emerald-200 bg-emerald-50/60"
              }`}>
                <div className="font-semibold text-[#172033]">
                  {recommendations.length > 0
                    ? `${recommendations[0].severity} priority · ${getRecommendationTitle(recommendations[0])}`
                    : profile.activity_class === "Protected/system process"
                    ? "Protected system process"
                    : profile.activity_class === "Insufficient information"
                    ? "Limited identity or access"
                    : "No active resource warning detected"}
                </div>
                <p className="mt-1 text-sm text-[#475467]">
                  {recommendations.length > 0
                    ? `${displayName} is using ${formatPct(profile.cpu_percent)} CPU and ${profile.memory_mb.toFixed(1)} MB of memory right now.`
                    : profile.activity_class === "Protected/system process"
                    ? "Keep this process running. Do not attempt to end a protected operating-system process."
                    : profile.activity_class === "Insufficient information"
                    ? "Some details aren't available. Don't close this task unless you know which app it belongs to."
                    : "The current measurements do not meet a recommendation rule. This is a point-in-time assessment, not a guarantee that the application is problem-free."}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="glass-well p-3">
                  <div className="text-[#667085]">Classification</div>
                  <div className="mt-1 font-semibold text-[#172033]">{profile.activity_class}</div>
                </div>
                <div className="glass-well p-3">
                  <div className="text-[#667085]">CPU / memory</div>
                  <div className="mt-1 font-semibold text-[#172033]">{formatPct(profile.cpu_percent)} · {profile.memory_mb.toFixed(1)} MB</div>
                </div>
                <div className="glass-well p-3">
                  <div className="text-[#667085]">Memory trend</div>
                  <div className="mt-1 font-semibold capitalize text-[#172033]">{profile.trends.memory_trend ?? "Not enough samples"}</div>
                </div>
                <div className="glass-well p-3">
                  <div className="text-[#667085]">Connections / threads</div>
                  <div className="mt-1 font-semibold text-[#172033]">{profile.open_connections} · {profile.threads}</div>
                </div>
              </div>

              {recommendations.length > 0 ? (
                <div className="space-y-2 text-sm text-[#475467]">
                  <p><strong className="text-[#172033]">What you can do:</strong> {getRecommendationAction(recommendations[0], displayName)}</p>
                  <details className="rounded-xl border border-[#E5EAF1] bg-white px-4 py-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[#2563EB]">
                      Show the measurements behind this suggestion
                    </summary>
                    <div className="mt-3 space-y-2 text-xs text-[#667085]">
                      <p>{hideExecutableNames(recommendations[0].resources_consumed)}</p>
                      <p>{hideExecutableNames(recommendations[0].is_usage_unusual)}</p>
                      {recommendations[0].evidence.map((item, index) => (
                        <p key={index}>{hideExecutableNames(item)}</p>
                      ))}
                      <p className="border-t border-[#EDF0F5] pt-2">{hideExecutableNames(recommendations[0].safety_and_uncertainty)}</p>
                    </div>
                  </details>
                </div>
              ) : (
                <p className="text-sm text-[#475467]">
                  No action is needed based on these measurements. Keep using the app normally; SYSTEMOS will show a suggestion if its resource use becomes unusual.
                </p>
              )}

              {profile.attributed_events.length > 0 && (
                <div className="space-y-2 border-t border-[#EDF0F5] pt-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#667085]">Related live diagnoses</h4>
                  {profile.attributed_events.map(event => (
                    <Link key={event.id} href={`/events/${event.id}`} className="block text-sm text-[#2563EB] hover:underline">
                      {event.severity}: {hideExecutableNames(event.probable_cause)} · {new Date(event.start_time * 1000).toLocaleString()}
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>

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
