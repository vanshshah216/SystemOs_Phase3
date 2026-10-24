"use client";
import { CheckCircle2, Info, RefreshCw } from "lucide-react";
import type { DiagnosisEvent } from "@/types";
import { useCurrentMetrics } from "@/hooks/useMetrics";

interface PreventionAndRecoveryProps {
  event: DiagnosisEvent | null | undefined;
}

export default function PreventionAndRecovery({ event }: PreventionAndRecoveryProps) {
  const { data: metrics } = useCurrentMetrics(2500);

  const cause = event?.probable_cause?.toLowerCase() || "";
  const isCpu = cause.includes("cpu");
  const isMem = cause.includes("memory");
  const isDisk = cause.includes("disk") || cause.includes("storage") || cause.includes("i/o");
  const isNet = cause.includes("network");
  const isGrowth =
    event?.evidence?.raw_stats?.rule_id === "E" ||
    cause.includes("memory growth") ||
    cause.includes("memory increase observed");

  // Determine current and baseline values for recovery monitoring
  let currentVal = 0;
  let baseVal: number | null = null;
  let metricLabel = "Resource";
  let unit = "%";

  if (isCpu) {
    currentVal = metrics?.cpu_percent ?? 0;
    baseVal = metrics?.cpu_context?.mean ?? null;
    metricLabel = "CPU Utilization";
    unit = "%";
  } else if (isMem || isGrowth) {
    currentVal = metrics?.ram_percent ?? 0;
    baseVal = metrics?.ram_context?.mean ?? null;
    metricLabel = "Memory Saturation";
    unit = "%";
  } else if (isDisk) {
    currentVal = (metrics?.disk_read_bytes ?? 0) / (1024 * 1024);
    baseVal = metrics?.disk_read_context?.mean != null
      ? metrics.disk_read_context.mean / (1024 * 1024)
      : null;
    metricLabel = "Storage Read Rate";
    unit = "MB/s";
  } else if (isNet) {
    currentVal = (metrics?.network_recv_bytes ?? 0) / (1024 * 1024);
    baseVal = metrics?.net_context?.mean != null
      ? metrics.net_context.mean / (1024 * 1024)
      : null;
    metricLabel = "Network Ingress";
    unit = "MB/s";
  }

  // Recovery evaluation comparing current to baseline
  const diffFromBaseline = baseVal === null ? null : currentVal - baseVal;
  let recoveryStatus: "Improving" | "Recovered" | "Still Elevated" | "Unresolved" = "Unresolved";
  let recoveryBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";

  if (baseVal === null) {
    recoveryStatus = event?.status === "resolved" ? "Recovered" : "Unresolved";
    recoveryBadge = "bg-slate-500/10 text-slate-400 border-slate-500/30";
  } else if (currentVal <= baseVal + (isDisk || isNet ? 5 : 3.5)) {
    recoveryStatus = "Recovered";
    recoveryBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  } else if (diffFromBaseline !== null && diffFromBaseline < (isDisk || isNet ? 20 : 15)) {
    recoveryStatus = "Improving";
    recoveryBadge = "bg-sky-500/10 text-sky-400 border-sky-500/30";
  } else {
    recoveryStatus = "Still Elevated";
    recoveryBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  }

  if (!event) return null;

  if (isGrowth) {
    const raw = event.evidence?.raw_stats ?? {};
    const growthMb = typeof raw.growth_mb === "number" ? raw.growth_mb : null;
    const durationSeconds = typeof raw.observation_seconds === "number" ? raw.observation_seconds : null;

    return (
      <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-3">
        <div className="flex items-center gap-2 text-slate-200">
          <Info className="w-4 h-4 text-sky-400" />
          <h3 className="font-semibold">Memory increase observed</h3>
        </div>
        <p className="text-sm text-slate-300">
          {event.primary_display_name || event.primary_process || "A process"} used more resident memory over time.
          This trend alone does not show a memory leak, a performance problem, or that the app should be closed.
          Applications can use additional memory during normal work or while caching data.
        </p>
        {(growthMb !== null || durationSeconds !== null) && (
          <p className="text-xs text-slate-400">
            {growthMb !== null ? `${growthMb.toFixed(0)} MB measured increase` : ""}
            {growthMb !== null && durationSeconds !== null ? " over " : ""}
            {durationSeconds !== null ? `${(durationSeconds / 60).toFixed(0)} minutes` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#29323d]">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            SYSTEM REMEDIATION & RECOVERY
          </span>
          <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
            RECOMMENDED PREVENTION / ACTION
          </h3>
        </div>

        <span className="text-xs font-mono text-slate-400 bg-[#11171f] border border-[#232d38] px-3 py-1 rounded-md self-start sm:self-center">
          Target: {event.probable_cause}
        </span>
      </div>

      {/* Specific Prescriptive Recommendations based on diagnosis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
              Prescriptive Guidance (Recommendation-First)
            </h4>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Non-Destructive
            </span>
          </div>

          <ul className="space-y-2 text-xs font-mono text-slate-200">
            {isCpu && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Review the top CPU-consuming processes in the Attribution view.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Consider closing or pausing a non-essential background application.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Consider postponing CPU-heavy batch workloads until utilization normalizes.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring telemetry after the manual intervention.</span>
                </li>
              </>
            )}

            {isMem && !isGrowth && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Review memory-heavy applications ({event.primary_display_name || event.primary_process || "primary observed contributor"}).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Close unused application windows or browser tabs if appropriate.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Reduce active concurrent workload if possible to alleviate memory and swap contention.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    {baseVal !== null
                      ? `Continue monitoring whether RAM usage returns toward the measured baseline (${baseVal.toFixed(1)}%).`
                      : "Continue monitoring; a historical RAM baseline is not available yet."}
                  </span>
                </li>
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
                  Notice: This system does not automatically terminate applications.
                </div>
              </>
            )}

            {isDisk && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Identify the process generating heavy I/O ({event.primary_display_name || event.primary_process || "Storage Worker"}).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Allow expected backup, system update, or file-transfer operations to complete.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Consider pausing non-essential disk-heavy activity (indexing, large archive extraction).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring after intervention to verify queue normalization.</span>
                </li>
                <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700 text-[11px] font-mono text-slate-400">
                  Notice: Do NOT terminate essential system storage services or flush operational databases.
                </div>
              </>
            )}

            {isNet && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Review active downloads, uploads, and peer network socket streams.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Check background cloud synchronization utilities and package managers.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Pause non-essential file transfers if network contention degrades critical latency.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring after intervention until throughput settles.</span>
                </li>
              </>
            )}

          </ul>
        </div>

        {/* SECTION 8: MONITOR RECOVERY PANEL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              Monitoring recovery...
            </h4>
            <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${recoveryBadge}`}>
              Status: {recoveryStatus}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#11171f] border border-[#232d38] space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tracked Metric</span>
              <span className="text-slate-200 font-bold">{metricLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Observed Value</span>
              <span className="text-base font-bold text-slate-100">
                {currentVal.toFixed(1)} {unit}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Baseline Target</span>
              <span className="text-slate-300">
                {baseVal !== null ? `${baseVal.toFixed(1)} ${unit}` : "Not available"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="pt-1 space-y-1.5">
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                {baseVal !== null && (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      recoveryStatus === "Recovered"
                        ? "bg-emerald-500"
                        : recoveryStatus === "Improving"
                        ? "bg-sky-400"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.max(15, Math.min(100, 100 - ((diffFromBaseline ?? 0) / (baseVal || 1)) * 50))}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 9: SAFETY NOTICE BANNER */}
      <div className="p-4 rounded-lg bg-sky-500/5 border border-sky-500/20 flex items-start gap-3 text-xs font-sans text-slate-300">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-sky-400 block mb-0.5 font-mono uppercase tracking-wider text-[11px]">
            Safety Guarantee & Recommendation-First Policy
          </span>
          SYSTEMOS provides recommendations based on observed telemetry. It does not automatically terminate arbitrary processes or system services.
        </div>
      </div>
    </div>
  );
}
