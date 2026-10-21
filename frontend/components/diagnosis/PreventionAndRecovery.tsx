"use client";
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle2, TrendingDown, Clock, Info, RefreshCw } from "lucide-react";
import type { DiagnosisEvent, SystemMetric } from "@/types";
import { useCurrentMetrics } from "@/hooks/useMetrics";

interface PreventionAndRecoveryProps {
  event: DiagnosisEvent | null | undefined;
}

export default function PreventionAndRecovery({ event }: PreventionAndRecoveryProps) {
  const { data: metrics } = useCurrentMetrics(2500);
  const [intervened, setIntervened] = useState(false);

  if (!event) return null;

  const cause = event.probable_cause?.toLowerCase() || "";
  const isCpu = cause.includes("cpu");
  const isMem = cause.includes("memory");
  const isDisk = cause.includes("disk") || cause.includes("storage") || cause.includes("i/o");
  const isNet = cause.includes("network");
  const isGrowth = cause.includes("growth");

  // Determine current and baseline values for recovery monitoring
  let currentVal = 0;
  let baseVal = 0;
  let metricLabel = "Resource";
  let unit = "%";

  if (isCpu) {
    currentVal = metrics?.cpu_percent ?? 0;
    baseVal = metrics?.cpu_context?.mean ?? 35;
    metricLabel = "CPU Utilization";
    unit = "%";
  } else if (isMem || isGrowth) {
    currentVal = metrics?.ram_percent ?? 0;
    baseVal = metrics?.ram_context?.mean ?? 60;
    metricLabel = "Memory Saturation";
    unit = "%";
  } else if (isDisk) {
    currentVal = (metrics?.disk_read_bytes ?? 0) / (1024 * 1024);
    baseVal = (metrics?.disk_read_context?.mean ?? 2_000_000) / (1024 * 1024);
    metricLabel = "Storage Read Rate";
    unit = "MB/s";
  } else if (isNet) {
    currentVal = (metrics?.network_recv_bytes ?? 0) / (1024 * 1024);
    baseVal = (metrics?.net_context?.mean ?? 1_000_000) / (1024 * 1024);
    metricLabel = "Network Ingress";
    unit = "MB/s";
  }

  // Recovery value history tracker for trajectory demonstration
  const [valHistory, setValHistory] = useState<number[]>([]);

  useEffect(() => {
    if (currentVal > 0) {
      setValHistory(prev => {
        if (prev.length === 0 || Math.abs(prev[prev.length - 1] - currentVal) >= 0.2) {
          const next = [...prev, parseFloat(currentVal.toFixed(1))];
          return next.slice(-5);
        }
        return prev;
      });
    }
  }, [currentVal]);

  // Recovery evaluation comparing current to baseline
  const diffFromBaseline = currentVal - baseVal;
  let recoveryStatus: "Improving" | "Recovered" | "Still Elevated" | "Unresolved" = "Still Elevated";
  let recoveryBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";

  if (currentVal <= baseVal + (isDisk || isNet ? 5 : 3.5)) {
    recoveryStatus = "Recovered";
    recoveryBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  } else if (valHistory.length >= 2 && valHistory[valHistory.length - 1] < valHistory[0]) {
    recoveryStatus = "Improving";
    recoveryBadge = "bg-sky-500/10 text-sky-400 border-sky-500/30";
  } else if (diffFromBaseline < (isDisk || isNet ? 20 : 15)) {
    recoveryStatus = "Improving";
    recoveryBadge = "bg-sky-500/10 text-sky-400 border-sky-500/30";
  } else if (event.status === "resolved") {
    recoveryStatus = "Recovered";
    recoveryBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  } else {
    recoveryStatus = "Still Elevated";
    recoveryBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  }

  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e293b]">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            SYSTEM REMEDIATION & RECOVERY
          </span>
          <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
            RECOMMENDED PREVENTION / ACTION
          </h3>
        </div>

        <span className="text-xs font-mono text-slate-400 bg-[#0d1322] border border-[#1a243a] px-3 py-1 rounded-md self-start sm:self-center">
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
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Review the top CPU-consuming processes in the Attribution view.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Consider closing or pausing a non-essential background application.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Consider postponing CPU-heavy batch workloads until utilization normalizes.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring telemetry after the manual intervention.</span>
                </li>
              </>
            )}

            {isMem && !isGrowth && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Review memory-heavy applications ({event.primary_process || "primary observed contributor"}).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Close unused application windows or browser tabs if appropriate.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Reduce active concurrent workload if possible to alleviate memory and swap contention.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring to verify whether RAM usage returns toward baseline ({baseVal.toFixed(1)}%).</span>
                </li>
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
                  Notice: This system does not automatically terminate applications.
                </div>
              </>
            )}

            {isDisk && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Identify the process generating heavy I/O ({event.primary_process || "Storage Worker"}).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Allow expected backup, system update, or file-transfer operations to complete.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Consider pausing non-essential disk-heavy activity (indexing, large archive extraction).</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
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
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Review active downloads, uploads, and peer network socket streams.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Check background cloud synchronization utilities and package managers.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Pause non-essential file transfers if network contention degrades critical latency.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring after intervention until throughput settles.</span>
                </li>
              </>
            )}

            {isGrowth && (
              <>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>Review the process memory trend over consecutive sample windows.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>Consider gracefully restarting the application ({event.primary_process || "Target Process"}) if appropriate.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>Continue monitoring memory allocation footprint after restart.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>Escalate to development teams only if the growth pattern repeatedly recurs across executions.</span>
                </li>
                <div className="p-2.5 rounded bg-purple-500/10 border border-purple-500/30 text-[11px] font-mono text-purple-300">
                  Terminology Standard: Labelled as &quot;Sustained unusual memory growth&quot; — never prematurely declared a confirmed memory leak without heap profiler evidence.
                </div>
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

          <div className="p-4 rounded-lg bg-[#0d1322] border border-[#1a243a] space-y-4 font-mono text-xs">
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
                {baseVal.toFixed(1)} {unit}
              </span>
            </div>

            {/* Live Trajectory Sequence */}
            <div className="p-3 rounded-lg bg-[#080d16] border border-[#162032] space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Recovery Trajectory Progression:</span>
                <span className="text-slate-300 font-bold">
                  {valHistory.length > 1
                    ? valHistory.map(v => `${v.toFixed(1)}${unit}`).join(" → ")
                    : `${currentVal.toFixed(1)}${unit}`}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Evaluated against historical baseline</span>
                <span className={recoveryStatus === "Recovered" ? "text-emerald-400 font-bold" : "text-sky-400"}>
                  {recoveryStatus === "Recovered" ? "Normal Target Reached" : `${Math.abs(diffFromBaseline).toFixed(1)} ${unit} delta`}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="pt-1 space-y-1.5">
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    recoveryStatus === "Recovered"
                      ? "bg-emerald-500"
                      : recoveryStatus === "Improving"
                      ? "bg-sky-400"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.max(15, Math.min(100, 100 - (diffFromBaseline / (baseVal || 1)) * 50))}%` }}
                />
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
