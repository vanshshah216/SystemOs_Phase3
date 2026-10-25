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
  let recoveryBadge = "bg-amber-50 text-amber-700 border-amber-200";

  if (baseVal === null) {
    recoveryStatus = event?.status === "resolved" ? "Recovered" : "Unresolved";
    recoveryBadge = "bg-slate-50 text-slate-600 border-slate-200";
  } else if (currentVal <= baseVal + (isDisk || isNet ? 5 : 3.5)) {
    recoveryStatus = "Recovered";
    recoveryBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (diffFromBaseline !== null && diffFromBaseline < (isDisk || isNet ? 20 : 15)) {
    recoveryStatus = "Improving";
    recoveryBadge = "bg-blue-50 text-blue-700 border-blue-200";
  } else {
    recoveryStatus = "Still Elevated";
    recoveryBadge = "bg-rose-50 text-rose-700 border-rose-200";
  }

  if (!event) return null;

  if (isGrowth) {
    const raw = event.evidence?.raw_stats ?? {};
    const growthMb = typeof raw.growth_mb === "number" ? raw.growth_mb : null;
    const durationSeconds = typeof raw.observation_seconds === "number" ? raw.observation_seconds : null;

    return (
      <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-3 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Info className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-base">Memory increase observed</h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          {event.primary_display_name || event.primary_process || "A process"} used more resident memory over time.
          This trend alone does not show a memory leak, a performance problem, or that the app should be closed.
          Applications can use additional memory during normal work or while caching data.
        </p>
        {(growthMb !== null || durationSeconds !== null) && (
          <p className="text-xs text-slate-500 font-mono">
            {growthMb !== null ? `${growthMb.toFixed(0)} MB measured increase` : ""}
            {growthMb !== null && durationSeconds !== null ? " over " : ""}
            {durationSeconds !== null ? `${(durationSeconds / 60).toFixed(0)} minutes` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
            SYSTEM REMEDIATION & RECOVERY
          </span>
          <h3 className="text-lg font-bold text-[#172033] font-sans mt-0.5">
            RECOMMENDED PREVENTION / ACTION
          </h3>
        </div>

        <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg self-start sm:self-center font-semibold">
          Target: {event.probable_cause}
        </span>
      </div>

      {/* Specific Prescriptive Recommendations based on diagnosis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              Prescriptive Guidance (Recommendation-First)
            </h4>
            <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold">
              Non-Destructive
            </span>
          </div>

          <ul className="space-y-2 text-xs font-mono text-slate-700">
            {isCpu && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Review the top CPU-consuming processes in the Attribution view.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Consider closing or pausing a non-essential background application.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Consider postponing CPU-heavy batch workloads until utilization normalizes.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Continue monitoring telemetry after the manual intervention.</span>
                </li>
              </>
            )}

            {isMem && !isGrowth && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Review memory-heavy applications ({event.primary_display_name || event.primary_process || "primary observed contributor"}).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Close unused application windows or browser tabs if appropriate.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Reduce active concurrent workload if possible to alleviate memory and swap contention.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    {baseVal !== null
                      ? `Continue monitoring whether RAM usage returns toward the measured baseline (${baseVal.toFixed(1)}%).`
                      : "Continue monitoring; a historical RAM baseline is not available yet."}
                  </span>
                </li>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-mono text-amber-800">
                  Notice: This system does not automatically terminate applications.
                </div>
              </>
            )}

            {isDisk && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Identify the process generating heavy I/O ({event.primary_display_name || event.primary_process || "Storage Worker"}).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Allow expected backup, system update, or file-transfer operations to complete.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Consider pausing non-essential disk-heavy activity (indexing, large archive extraction).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Continue monitoring after intervention to verify queue normalization.</span>
                </li>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                  Notice: Do NOT terminate essential system storage services or flush operational databases.
                </div>
              </>
            )}

            {isNet && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Review active downloads, uploads, and peer network socket streams.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Check background cloud synchronization utilities and package managers.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Pause non-essential file transfers if network contention degrades critical latency.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Continue monitoring after intervention until throughput settles.</span>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* MONITOR RECOVERY PANEL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              Monitoring recovery...
            </h4>
            <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${recoveryBadge}`}>
              Status: {recoveryStatus}
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-4 font-mono text-xs shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Tracked Metric</span>
              <span className="text-slate-900 font-bold">{metricLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Observed Value</span>
              <span className="text-base font-bold text-slate-900">
                {currentVal.toFixed(1)} {unit}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Baseline Target</span>
              <span className="text-slate-700 font-semibold">
                {baseVal !== null ? `${baseVal.toFixed(1)} ${unit}` : "Not available"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="pt-1 space-y-1.5">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                {baseVal !== null && (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      recoveryStatus === "Recovered"
                        ? "bg-emerald-500"
                        : recoveryStatus === "Improving"
                        ? "bg-blue-500"
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

      {/* SAFETY NOTICE BANNER */}
      <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-3 text-xs font-sans text-slate-700">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-blue-700 block mb-0.5 font-mono uppercase tracking-wider text-[11px]">
            Safety Guarantee & Recommendation-First Policy
          </span>
          SYSTEMOS provides recommendations based on observed telemetry. It does not automatically terminate arbitrary processes or system services.
        </div>
      </div>
    </div>
  );
}
