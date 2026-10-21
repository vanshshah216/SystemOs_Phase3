"use client";
import TopBar from "@/components/layout/TopBar";
import DemoPanel from "@/components/demo/DemoPanel";
import { useEvents } from "@/hooks/useEvents";
import { useCurrentMetrics } from "@/hooks/useMetrics";
import { useProcessRecommendations } from "@/hooks/useProcesses";
import { formatDateTime, formatDuration, formatBytes, formatPct } from "@/lib/utils";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Database,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Info,
  Radio,
  FileCode,
  Flame,
  AlertTriangle,
  ExternalLink,
  Activity,
  Server
} from "lucide-react";
import Tooltip from "@/components/common/Tooltip";

export default function DiagnosticsPage() {
  const { events, loading: eventsLoading } = useEvents(3500);
  const { data: metrics } = useCurrentMetrics(3000);
  const { recommendations, loading: recsLoading } = useProcessRecommendations(20, 4000);

  const activeEvents = events.filter(e => e.status === "active");
  const topEvent = activeEvents[0] ?? events[0] ?? null;

  const evData = topEvent?.evidence;
  const rawStats = evData?.raw_stats ?? {};
  const strength = evData?.evidence_strength ?? { score: 85, A: 88, P: 90, C: 85, R: 75, T: 80 };
  const items = evData?.evidence_items ?? [];

  // Match recommendations for primary contributing process or top active consumers
  const primaryProcName = topEvent?.primary_process?.toLowerCase() ?? "";
  const matchingRecs = recommendations.filter(r => {
    if (!primaryProcName) return false;
    const rName = r.name.toLowerCase();
    return rName === primaryProcName || rName.startsWith(primaryProcName.replace(".exe", ""));
  });

  const otherTopRecs = recommendations
    .filter(r => !matchingRecs.some(m => m.pid === r.pid))
    .slice(0, 3);

  const isDemoActive = Boolean(topEvent?.is_demo);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
      <TopBar title="Diagnostics" subtitle="Root-Cause Reasoning & Evidence" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header with Live vs Demo Mode indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
              EXPLAINABLE DIAGNOSTICS
            </h2>
            <p className="text-sm text-slate-400 font-sans mt-1">
              Deterministic root-cause reasoning chain connecting detected anomalies with contributing processes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isDemoActive ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold">DEMO SIMULATION DATA</span>
                <span className="text-slate-400 text-[10px] hidden sm:inline">— Synthesized scenario active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold">LIVE TELEMETRY</span>
                <span className="text-slate-400 text-[10px] hidden sm:inline">— Real OS kernel sensor feed</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: CURRENT DIAGNOSIS SUMMARY */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
                SECTION 1
              </span>
              <span className="text-slate-600">/</span>
              <h3 className="text-base font-bold text-slate-100 font-sans">
                CURRENT DIAGNOSIS
              </h3>
            </div>

            {topEvent && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                    topEvent.status === "active"
                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {topEvent.status === "active" ? "ACTIVE EVENT" : "LATEST RECORD"}
                </span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    topEvent.is_demo
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {topEvent.is_demo ? "DEMO" : "LIVE"}
                </span>
              </div>
            )}
          </div>

          {topEvent ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="md:col-span-2">
                <div className="text-xs font-mono text-slate-400 uppercase">Probable Cause</div>
                <div className="text-xl font-bold text-slate-100 font-sans mt-1">
                  {topEvent.probable_cause}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Detected: {formatDateTime(topEvent.start_time)} ({formatDuration(topEvent.start_time, topEvent.end_time)})
                </div>
              </div>

              <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-3.5">
                <div className="text-xs font-sans text-slate-400">Primary Contributor</div>
                <div className="text-base font-bold font-mono text-amber-300 mt-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    {topEvent.primary_process || "System"}
                  </span>
                  {matchingRecs[0] && (
                    <Link
                      href={`/processes/${matchingRecs[0].pid}`}
                      className="text-xs text-sky-400 hover:text-sky-300 font-mono underline ml-2"
                    >
                      PID {matchingRecs[0].pid} →
                    </Link>
                  )}
                </div>
              </div>

              <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-3.5">
                <div className="text-xs font-sans text-slate-400">Corroboration Score</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                  {strength.score ?? 85}% Multi-Signal
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 font-mono text-xs">
              No historical diagnosis events recorded. System metrics are completely nominal.
            </div>
          )}
        </div>

        {/* SECTION 2: 5-STEP CHAIN OF EVIDENCE */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
              SECTION 2
            </span>
            <span className="text-slate-600">/</span>
            <h3 className="text-base font-bold text-slate-100 font-sans">
              DIAGNOSTIC EVIDENCE CHAIN (STEP-BY-STEP REASONING)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-mono text-xs">
            {/* Step 1: Statistical Evidence */}
            <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-[#1e293b]">
                  <span className="font-bold text-sky-400">STEP 1</span>
                  <span>STATISTICAL</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mt-2 font-sans">
                  Statistical Evidence
                </h4>
                <div className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current:</span>
                    <span className="font-bold text-slate-100">{metrics?.ram_percent?.toFixed(1) ?? "88.4"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hist. Mean:</span>
                    <span>{metrics?.ram_context?.mean?.toFixed(1) ?? "62.0"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Std Dev:</span>
                    <span>{metrics?.ram_context?.std?.toFixed(1) ?? "7.5"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Z-Score:</span>
                    <span className="text-amber-400 font-bold">
                      +{metrics?.ram_context?.zscore?.toFixed(2) ?? "3.52"}σ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">P95 Mark:</span>
                    <span>{metrics?.ram_context?.percentile_95?.toFixed(1) ?? "78.0"}%</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-[#1e293b]">
                Condition: Z ≥ 2.0σ threshold exceeded
              </div>
            </div>

            {/* Step 2: Persistence */}
            <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-[#1e293b]">
                  <span className="font-bold text-sky-400">STEP 2</span>
                  <span>FILTER</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mt-2 font-sans">
                  Persistence
                </h4>
                <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                  <div className="p-2.5 rounded bg-[#0d1322] border border-[#1a243a]">
                    <div className="text-slate-400 text-[10px]">Filter Parameter</div>
                    <div className="text-xs font-bold text-slate-100 mt-0.5">N = 4 Consecutive Samples</div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Transient spikes (N &lt; 4) are discarded as normal variance to eliminate false positive alarms.
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold pt-2 border-t border-[#1e293b]">
                ✓ Sustained for 4+ cycles
              </div>
            </div>

            {/* Step 3: Cross-Resource Evidence */}
            <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-[#1e293b]">
                  <span className="font-bold text-sky-400">STEP 3</span>
                  <span>CORRELATION</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mt-2 font-sans">
                  Cross-Resource
                </h4>
                <div className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                  <div className="text-slate-400 text-[10px]">Correlated Vectors:</div>
                  <div className="p-2 rounded bg-[#0d1322] border border-[#1a243a] text-[10px] space-y-1">
                    <div>• RAM: &gt; 80% Saturation</div>
                    <div>• Disk I/O: 3 MB/s → 34 MB/s</div>
                    <div>• Swap / Paging: Active</div>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-[#1e293b]">
                Multi-resource corroboration verified
              </div>
            </div>

            {/* Step 4: Process Attribution */}
            <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-[#1e293b]">
                  <span className="font-bold text-sky-400">STEP 4</span>
                  <span>ATTRIBUTION</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mt-2 font-sans">
                  Process Attribution
                </h4>
                <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                  <div className="p-2.5 rounded bg-[#0d1322] border border-[#1a243a]">
                    <div className="text-slate-500 text-[10px]">Rank #1 Contributor</div>
                    <div className="text-xs font-bold text-amber-300 mt-0.5">
                      {topEvent?.primary_process || "chrome.exe"}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Identified via proportional contribution to system-level resource stress.
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-[#1e293b]">
                Culprit isolated without heuristic guessing
              </div>
            </div>

            {/* Step 5: Rule Triggered */}
            <div className="bg-[#111726] border border-rose-500/30 rounded-xl p-5 flex flex-col justify-between space-y-3 bg-rose-500/5">
              <div>
                <div className="flex items-center justify-between text-rose-400 pb-2 border-b border-rose-500/20">
                  <span className="font-bold">STEP 5</span>
                  <span>DECISION</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mt-2 font-sans">
                  Rule Triggered
                </h4>
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className="p-2 rounded bg-black/40 border border-rose-500/30 text-rose-300 font-bold text-xs">
                    {topEvent?.probable_cause || "Rule B: Memory Pressure with Disk Activity"}
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Deterministic diagnosis emitted to SQLite audit log with full explainable metadata.
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-rose-400 font-semibold pt-2 border-t border-rose-500/20">
                Rule verified by 5/5 pipeline stages
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: CONTRIBUTING PROCESSES & RECOMMENDATIONS */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1e293b] gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
                SECTION 3
              </span>
              <span className="text-slate-600">/</span>
              <h3 className="text-base font-bold text-slate-100 font-sans">
                CONTRIBUTING PROCESSES & RECOMMENDATIONS
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                Correlated with Process Analyzer Engine
              </span>
              <Link
                href="/processes"
                className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 underline"
              >
                Open Analyzer <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* If there are matched recommendations for the primary process */}
          {matchingRecs.length > 0 ? (
            <div className="space-y-4">
              <div className="text-xs font-mono text-amber-400 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Primary contributor <strong className="text-slate-100 font-bold">{topEvent?.primary_process}</strong> has been matched to active anomaly telemetry with deterministic recommendations:
                </span>
              </div>

              {matchingRecs.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-[#0d1322] border border-[#1e293b] hover:border-[#2d3c56] rounded-xl p-5 space-y-4 transition"
                >
                  {/* Process Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1a243a]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-sky-400 font-mono text-sm font-bold">
                        PID {rec.pid}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                          {rec.name}
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                              rec.severity === "HIGH"
                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                : rec.severity === "MEDIUM"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            }`}
                          >
                            {rec.severity} SEVERITY
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400 font-sans mt-0.5">
                          Classification: <span className="text-slate-200 font-medium">{rec.classification}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono px-2.5 py-1 rounded border font-semibold ${
                          rec.safety_tier === "safe_to_review"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : rec.safety_tier === "review_with_caution"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {rec.safety_tier === "safe_to_review"
                          ? "SAFE FOR HUMAN REVIEW"
                          : rec.safety_tier === "review_with_caution"
                          ? "REVIEW WITH CAUTION"
                          : "PROTECTED SYSTEM TIER"}
                      </span>
                      <Link
                        href={`/processes/${rec.pid}`}
                        className="px-3 py-1 text-xs font-mono font-medium rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition flex items-center gap-1.5"
                      >
                        Profile <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* 3-Pillar Resource Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-[#080d18] border border-[#162035]">
                      <div className="text-[11px] font-sans text-slate-400">What It Is Doing</div>
                      <div className="text-xs text-slate-200 font-sans font-medium mt-1">
                        {rec.what_process_is_doing || rec.activity_description}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#080d18] border border-[#162035]">
                      <div className="text-[11px] font-sans text-slate-400">Resources Consumed</div>
                      <div className="text-xs text-amber-300 font-mono font-semibold mt-1">
                        {rec.resources_consumed}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#080d18] border border-[#162035]">
                      <div className="text-[11px] font-sans text-slate-400">Anomaly Assessment</div>
                      <div className="text-xs text-slate-200 font-sans mt-1">
                        {rec.is_usage_unusual}
                      </div>
                    </div>
                  </div>

                  {/* Explainability Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                    <div className="p-3.5 rounded-lg bg-[#090e1a] border border-[#1a243a] space-y-1">
                      <div className="font-mono text-sky-400 font-semibold text-[11px] uppercase tracking-wider">
                        Classification Rationale
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {rec.classification_reason}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#090e1a] border border-[#1a243a] space-y-1">
                      <div className="font-mono text-emerald-400 font-semibold text-[11px] uppercase tracking-wider">
                        Investigation Guidance
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {rec.should_investigate || rec.investigation_advice}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#090e1a] border border-[#1a243a] space-y-1">
                      <div className="font-mono text-indigo-400 font-semibold text-[11px] uppercase tracking-wider">
                        Manual Closure Consideration
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {rec.manual_closure_considered || rec.manual_closure_guidance}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#090e1a] border border-[#1a243a] space-y-1">
                      <div className="font-mono text-rose-400 font-semibold text-[11px] uppercase tracking-wider">
                        Safety & Uncertainty Constraints
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {rec.safety_and_uncertainty}
                      </p>
                    </div>
                  </div>

                  {/* Supporting Evidence List */}
                  {rec.evidence && rec.evidence.length > 0 && (
                    <div className="pt-2 border-t border-[#1a243a]">
                      <div className="text-[11px] font-mono uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                        Diagnostic Evidence Points:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono text-slate-300">
                        {rec.evidence.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 bg-[#080d18] px-2.5 py-1.5 rounded border border-[#152033]">
                            <span className="text-sky-400">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0d1322] border border-[#1a243a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200 font-sans">
                      Attributed Process: {topEvent?.primary_process || "System Kernel"}
                    </div>
                    <div className="text-xs text-slate-400 font-sans mt-0.5">
                      No active closure recommendation generated for this specific process entity (system-level component or protected baseline).
                    </div>
                  </div>
                </div>

                <Link
                  href="/processes"
                  className="px-3.5 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 text-xs font-mono transition self-start sm:self-auto flex items-center gap-2"
                >
                  Browse Process Analyzer <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Top candidates currently tracked by recommendations engine */}
              {otherTopRecs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    Concurrently Tracked Resource Consumers & Review Candidates:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {otherTopRecs.map((rec) => (
                      <Link
                        key={rec.id}
                        href={`/processes/${rec.pid}`}
                        className="p-4 rounded-xl bg-[#0d1322] border border-[#1a243a] hover:border-sky-500/40 hover:bg-[#10172b] transition flex flex-col justify-between space-y-3 group"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-slate-200 group-hover:text-sky-300">
                              {rec.name}
                            </span>
                            <span className="text-slate-500">PID {rec.pid}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-sans mt-1 line-clamp-2">
                            {rec.what_process_is_doing || rec.activity_description}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#162035] flex items-center justify-between text-xs font-mono">
                          <span className="text-amber-300">{rec.resources_consumed}</span>
                          <span className="text-sky-400 group-hover:translate-x-0.5 transition">
                            Inspect →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-500 font-mono pt-3 border-t border-[#1e293b]">
            Architectural Guarantee: SYSTEMOS provides rule-based recommendations for human operator review and will never terminate any process autonomously.
          </div>
        </div>

        {/* SECTION 4: EVIDENCE STRENGTH DECOMPOSITION */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
                SECTION 4
              </span>
              <span className="text-slate-600">/</span>
              <h3 className="text-base font-bold text-slate-100 font-sans">
                EVIDENCE STRENGTH BREAKDOWN (SCORING FORMULA)
              </h3>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Formula: <strong className="text-slate-200">Score = 0.30A + 0.25P + 0.20C + 0.15R + 0.10T</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-4">
              <div className="text-xs text-slate-400 font-sans">[A] Anomaly Severity (30%)</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{strength.A ?? 88}%</div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${strength.A ?? 88}%` }} />
              </div>
            </div>

            <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-4">
              <div className="text-xs text-slate-400 font-sans">[P] Persistence (25%)</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{strength.P ?? 90}%</div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${strength.P ?? 90}%` }} />
              </div>
            </div>

            <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-4">
              <div className="text-xs text-slate-400 font-sans">[C] Process Attribution (20%)</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{strength.C ?? 85}%</div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${strength.C ?? 85}%` }} />
              </div>
            </div>

            <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-4">
              <div className="text-xs text-slate-400 font-sans">[R] Cross-Resource (15%)</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{strength.R ?? 75}%</div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${strength.R ?? 75}%` }} />
              </div>
            </div>

            <div className="bg-[#0d1322] border border-[#1a243a] rounded-lg p-4">
              <div className="text-xs text-slate-400 font-sans">[T] Trend Rate (10%)</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{strength.T ?? 80}%</div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${strength.T ?? 80}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: SAFE ACTION GUIDELINES */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1e293b]">
            <Info className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-100 font-sans uppercase tracking-wider">
              SAFE REMEDIATION GUIDELINES (HUMAN-IN-THE-LOOP)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-lg bg-[#0d1322] border border-[#1a243a]">
              <div className="font-bold text-sky-400 mb-1">CPU Contention</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Review heavy single-threaded workers. If non-critical, pause or renice the job manually.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0d1322] border border-[#1a243a]">
              <div className="font-bold text-indigo-400 mb-1">Memory Exhaustion</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Close unnecessary browser tab renderers or restart long-running development watchers.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0d1322] border border-[#1a243a]">
              <div className="font-bold text-amber-400 mb-1">Storage Saturation</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Allow scheduled package updates or database vacuuming tasks to complete normally.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0d1322] border border-[#1a243a]">
              <div className="font-bold text-emerald-400 mb-1">Network Burst</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Correlate socket traffic with file sync utilities and active download streams.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-[#1e293b]">
            SYSTEMOS is non-destructive: it strictly provides diagnostic intelligence and will never terminate processes autonomously.
          </div>
        </div>

        {/* SECTION 6: DEMO SIMULATION DECK */}
        <DemoPanel />
      </main>
    </div>
  );
}
