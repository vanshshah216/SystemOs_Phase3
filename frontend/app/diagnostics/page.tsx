"use client";
import TopBar from "@/components/layout/TopBar";
import DemoPanel from "@/components/demo/DemoPanel";
import { useEvents } from "@/hooks/useEvents";
import { useCurrentMetrics } from "@/hooks/useMetrics";
import { useProcessRecommendations } from "@/hooks/useProcesses";
import { formatDateTime, formatDuration } from "@/lib/utils";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  Cpu,
  Info,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

export default function DiagnosticsPage() {
  const { events, loading: eventsLoading, error: eventsError } = useEvents(3500);
  const { data: metrics, error: metricsError } = useCurrentMetrics(3000);
  const { recommendations, loading: recsLoading } = useProcessRecommendations(20, 30000);

  const activeEvents = events.filter(e => e.status === "active");
  const topEvent = activeEvents[0] ?? events[0] ?? null;

  const evData = topEvent?.evidence;
  const rawStats = evData?.raw_stats ?? {};
  const strength = evData?.evidence_strength;
  const items = evData?.evidence_items ?? [];
  const primaryLabel =
    topEvent?.primary_display_name ||
    topEvent?.primary_process ||
    "Process cause not established";
  const primaryExe = topEvent?.primary_process_name || topEvent?.primary_process;

  // Match recommendations for primary contributing process or top active consumers
  const primaryProcName = (primaryExe || "").toLowerCase();
  const matchingRecs = recommendations.filter(r => {
    if (!primaryProcName && !primaryLabel) return false;
    const rName = r.name.toLowerCase();
    return (
      rName === primaryProcName ||
      rName.startsWith(primaryProcName.replace(".exe", "")) ||
      primaryLabel.toLowerCase().includes(rName.replace(".exe", ""))
    );
  });

  const otherTopRecs = recommendations
    .filter(r => !matchingRecs.some(m => m.pid === r.pid))
    .slice(0, 3);

  const isDemoActive = Boolean(topEvent?.is_demo);
  const isMemoryGrowthObservation =
    rawStats.rule_id === "E" ||
    /memory growth|memory increase observed/i.test(topEvent?.probable_cause || "");

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      <TopBar title="Diagnostics" subtitle="Measured telemetry and event evidence" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header with Live vs Demo Mode indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033] font-sans">
              Diagnostics
            </h2>
            <p className="text-sm text-[#667085] font-sans mt-1">
              Recorded system measurements and the evidence attached to detected events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isDemoActive ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-bold">DEMO SIMULATION DATA</span>
                <span className="text-slate-500 text-[10px] hidden sm:inline">— Synthesized scenario active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold">LIVE TELEMETRY</span>
                <span className="text-slate-500 text-[10px] hidden sm:inline">— Windows / psutil telemetry</span>
              </div>
            )}
          </div>
        </div>

        {(eventsError || metricsError) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-800 shadow-xs" role="alert">
            {eventsError && <div>Event data unavailable: {eventsError}</div>}
            {metricsError && <div>Current metric data unavailable: {metricsError}</div>}
          </div>
        )}

        {/* SECTION 1: CURRENT DIAGNOSIS SUMMARY */}
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#172033] font-sans">
                {isMemoryGrowthObservation ? "Current observation" : "Current diagnosis"}
              </h3>
            </div>

            {topEvent && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                    isMemoryGrowthObservation
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : topEvent.status === "active"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {isMemoryGrowthObservation
                    ? topEvent.status === "active" ? "MONITORING" : "OBSERVATION"
                    : topEvent.status === "active" ? "ACTIVE EVENT" : "LATEST RECORD"}
                </span>
                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
                    topEvent.is_demo
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
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
                <div className="text-xs font-mono text-slate-500 uppercase font-semibold">
                  {isMemoryGrowthObservation ? "What was observed" : "Probable cause"}
                </div>
                <div className="text-xl font-bold text-slate-900 font-sans mt-1">
                  {topEvent.probable_cause}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  Detected: {formatDateTime(topEvent.start_time)} ({formatDuration(topEvent.start_time, topEvent.end_time)})
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 shadow-xs">
                <div className="text-xs font-sans text-slate-500 font-medium">
                  {isMemoryGrowthObservation ? "Application observed" : "Process association"}
                </div>
                <div className="text-base font-bold font-mono text-slate-900 mt-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate">
                    <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">{primaryLabel}</span>
                  </span>
                  {matchingRecs[0] && (
                    <Link
                      href={`/processes/${matchingRecs[0].pid}`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-mono underline ml-2 shrink-0"
                    >
                      PID {matchingRecs[0].pid} →
                    </Link>
                  )}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 shadow-xs">
                <div className="text-xs font-sans text-slate-500 font-medium">
                  {isMemoryGrowthObservation ? "Evidence score" : "Corroboration score"}
                </div>
                <div className="text-base font-bold font-mono text-emerald-600 mt-1">
                  {strength?.score != null ? `${strength.score}%` : "Not scored"}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              {eventsLoading
                ? "Loading diagnostic events..."
                : eventsError
                ? `Diagnosis events are unavailable: ${eventsError}`
                : "No diagnosis event is currently recorded; this alone does not confirm that every metric is nominal."}
            </div>
          )}
        </div>

        {/* SECTION 2: 5-STEP CHAIN OF EVIDENCE */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#172033] font-sans">
              How the diagnosis is evaluated
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-mono text-xs">
            {/* Step 1: Statistical Evidence */}
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-xl">
              <div>
                <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
                  <span className="font-bold text-blue-600">STEP 1</span>
                  <span>STATISTICAL</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-2 font-sans">
                  {isMemoryGrowthObservation ? "Current System RAM" : "Statistical Evidence"}
                </h4>
                <div className="mt-3 space-y-1.5 text-[11px] text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current:</span>
                    <span className="font-bold text-slate-900">{metrics?.ram_percent != null ? `${metrics.ram_percent.toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hist. Mean:</span>
                    <span>{metrics?.ram_context?.mean != null ? `${metrics.ram_context.mean.toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Std Dev:</span>
                    <span>{metrics?.ram_context?.std != null ? `${metrics.ram_context.std.toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Z-Score:</span>
                    <span className="text-blue-600 font-bold">
                      {metrics?.ram_context?.zscore != null ? `${metrics.ram_context.zscore.toFixed(2)}σ` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">P95 Mark:</span>
                    <span>{metrics?.ram_context?.percentile_95 != null ? `${metrics.ram_context.percentile_95.toFixed(1)}%` : "—"}</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                {isMemoryGrowthObservation
                  ? "System RAM statistics do not establish a process memory fault."
                  : "Statistical values are shown only when available from the backend."}
              </div>
            </div>

            {/* Step 2: Persistence */}
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-xl">
              <div>
                <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
                  <span className="font-bold text-blue-600">STEP 2</span>
                  <span>FILTER</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-2 font-sans">
                  Persistence
                </h4>
                <div className="mt-3 space-y-2 text-[11px] text-slate-700">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 shadow-xs">
                    <div className="text-slate-500 text-[10px]">Filter Parameter</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {isMemoryGrowthObservation
                        ? `${rawStats.sample_count ?? "—"} samples · ${typeof rawStats.observation_seconds === "number" ? `${(rawStats.observation_seconds / 60).toFixed(0)} min` : "duration unavailable"}`
                        : "Configured persistence filter"}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    {isMemoryGrowthObservation
                      ? "A memory trend is recorded as an observation. It does not by itself diagnose a leak or system slowdown."
                      : "Events are evaluated against persistence requirements before being recorded."}
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold pt-2 border-t border-slate-100">
                {isMemoryGrowthObservation ? "Measured trend" : "Persistence evaluated by backend"}
              </div>
            </div>

            {/* Step 3: Cross-Resource Evidence */}
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-xl">
              <div>
                <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
                  <span className="font-bold text-blue-600">STEP 3</span>
                  <span>CORRELATION</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-2 font-sans">
                  {isMemoryGrowthObservation ? "Recorded evidence" : "Cross-Resource"}
                </h4>
                <div className="mt-3 space-y-1.5 text-[11px] text-slate-700">
                  <div className="text-slate-500 text-[10px]">Correlated Vectors:</div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[10px] space-y-1 shadow-xs">
                    {(items.length > 0 ? items : ["No correlated measurements were recorded for this event."]).map((item: string, index: number) => (
                      <div key={index} className="text-slate-700">• {item}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                {isMemoryGrowthObservation ? "No cross-resource fault is implied" : "Only recorded evidence is shown"}
              </div>
            </div>

            {/* Step 4: Process Attribution */}
            <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-xl">
              <div>
                <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
                  <span className="font-bold text-blue-600">STEP 4</span>
                  <span>ATTRIBUTION</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-2 font-sans">
                  Process Attribution
                </h4>
                <div className="mt-3 space-y-2 text-[11px] text-slate-700">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 shadow-xs">
                    <div className="text-slate-500 text-[10px]">
                      {isMemoryGrowthObservation ? "Application observed" : "Rank #1 contributor"}
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                      {primaryLabel}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    {isMemoryGrowthObservation
                      ? "The process is associated with this memory trend; it is not identified as the cause of a system problem."
                      : "Process values are measured telemetry and do not alone prove causation."}
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                {isMemoryGrowthObservation ? "Association only" : "Attribution evidence"}
              </div>
            </div>

            {/* Step 5: Rule Triggered */}
            <div className={`border rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-xl ${
              isMemoryGrowthObservation ? "bg-white/90 border-blue-200" : "bg-rose-50/40 border-rose-200"
            }`}>
              <div>
                <div className={`flex items-center justify-between pb-2 ${
                  isMemoryGrowthObservation ? "text-blue-600 border-b border-blue-100" : "text-rose-600 border-b border-rose-200"
                }`}>
                  <span className="font-bold">STEP 5</span>
                  <span>DECISION</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mt-2 font-sans">
                  {isMemoryGrowthObservation ? "Observation recorded" : "Rule result"}
                </h4>
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className={`p-2.5 rounded-xl font-bold text-xs shadow-xs ${
                    isMemoryGrowthObservation ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-rose-50 border border-rose-200 text-rose-700"
                  }`}>
                    {topEvent?.probable_cause || "No event recorded"}
                  </div>
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    {isMemoryGrowthObservation
                      ? "This low-severity record describes an observed process memory trend, not a confirmed diagnosis."
                      : "The event and available supporting measurements are retained in the event history."}
                  </p>
                </div>
              </div>
              <div className={`text-[10px] font-semibold pt-2 border-t ${
                isMemoryGrowthObservation ? "border-blue-100 text-blue-600" : "border-rose-200 text-rose-600"
              }`}>
                {isMemoryGrowthObservation ? "Observation, not fault confirmation" : "Rule result"}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: CONTRIBUTING PROCESSES & RECOMMENDATIONS */}
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#172033] font-sans">
                Contributing processes and recommendations
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500">
                {recsLoading ? "Loading process context..." : "Process Analyzer data"}
              </span>
              <Link
                href="/processes"
                className="text-xs font-mono text-blue-600 hover:text-blue-700 flex items-center gap-1 underline font-semibold"
              >
                Open Analyzer <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* If there are matched recommendations for the primary process */}
          {matchingRecs.length > 0 ? (
            <div className="space-y-4">
              <div className="text-xs font-mono text-amber-800 flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl shadow-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  {isMemoryGrowthObservation
                    ? <>A measured memory trend was observed for <strong className="text-slate-900 font-bold">{primaryLabel}</strong>. It is not evidence of a system fault.</>
                    : <>Primary contributor <strong className="text-slate-900 font-bold">{primaryLabel}</strong> is associated with active anomaly telemetry; this association does not prove causation.</>}
                </span>
              </div>

              {matchingRecs.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-50/70 border border-slate-200/80 hover:border-blue-300 rounded-2xl p-5 space-y-4 transition-all duration-200 shadow-xs"
                >
                  {/* Process Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                    <div className="flex items-center gap-3">
                      <div className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono text-sm font-bold shadow-xs">
                        PID {rec.pid}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 font-mono flex items-center gap-2 flex-wrap">
                          {rec.display_name || rec.name}
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold border ${
                              rec.severity === "HIGH"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : rec.severity === "MEDIUM"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {rec.severity} SEVERITY
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 font-sans mt-0.5">
                          Classification: <span className="text-slate-800 font-semibold">{rec.classification}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono px-3 py-1 rounded-full border font-semibold ${
                          rec.safety_tier === "safe_to_review"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : rec.safety_tier === "review_with_caution"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
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
                        className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-1.5 shadow-xs"
                      >
                        Profile <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* 3-Pillar Resource Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <div className="text-[11px] font-sans text-slate-500">What It Is Doing</div>
                      <div className="text-xs text-slate-800 font-sans font-medium mt-1">
                        {rec.what_process_is_doing || rec.activity_description}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <div className="text-[11px] font-sans text-slate-500">Resources Consumed</div>
                      <div className="text-xs text-blue-700 font-mono font-bold mt-1">
                        {rec.resources_consumed}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      <div className="text-[11px] font-sans text-slate-500">Anomaly Assessment</div>
                      <div className="text-xs text-slate-800 font-sans mt-1">
                        {rec.is_usage_unusual}
                      </div>
                    </div>
                  </div>

                  {/* Explainability Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-xs">
                      <div className="font-mono text-blue-600 font-bold text-[11px] uppercase tracking-wider">
                        Classification Rationale
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {rec.classification_reason}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-xs">
                      <div className="font-mono text-emerald-600 font-bold text-[11px] uppercase tracking-wider">
                        Investigation Guidance
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {rec.should_investigate || rec.investigation_advice}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-xs">
                      <div className="font-mono text-blue-600 font-bold text-[11px] uppercase tracking-wider">
                        Manual Closure Consideration
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {rec.manual_closure_considered || rec.manual_closure_guidance}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-xs">
                      <div className="font-mono text-rose-600 font-bold text-[11px] uppercase tracking-wider">
                        Safety & Uncertainty Constraints
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {rec.safety_and_uncertainty}
                      </p>
                    </div>
                  </div>

                  {/* Supporting Evidence List */}
                  {rec.evidence && rec.evidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="text-[11px] font-mono uppercase text-slate-600 mb-1.5 flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        Diagnostic Evidence Points:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono text-slate-700">
                        {rec.evidence.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 shadow-xs">
                            <span className="text-blue-600">•</span>
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
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 font-sans">
                      Attributed Process: {primaryLabel}
                    </div>
                    <div className="text-xs text-slate-500 font-sans mt-0.5">
                      No active closure recommendation generated for this specific process entity (system-level component or protected baseline).
                    </div>
                  </div>
                </div>

                <Link
                  href="/processes"
                  className="px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-mono font-medium transition self-start sm:self-auto flex items-center gap-2 shadow-xs"
                >
                  Browse Process Analyzer <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Top candidates currently tracked by recommendations engine */}
              {otherTopRecs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-mono uppercase text-slate-500 font-semibold tracking-wider">
                    Concurrently Tracked Resource Consumers & Review Candidates:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {otherTopRecs.map((rec) => (
                      <Link
                        key={rec.id}
                        href={`/processes/${rec.pid}`}
                        className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between space-y-3 group shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {rec.display_name || rec.name}
                            </span>
                            <span className="text-slate-500">PID {rec.pid}</span>
                          </div>
                          <div className="text-xs text-slate-500 font-sans mt-1 line-clamp-2">
                            {rec.what_process_is_doing || rec.activity_description}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                          <span className="text-blue-600 font-semibold">{rec.resources_consumed}</span>
                          <span className="text-blue-600 group-hover:translate-x-0.5 transition font-semibold">
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

          <div className="text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-100">
            Architectural Guarantee: SYSTEMOS provides rule-based recommendations for human operator review and will never terminate any process autonomously.
          </div>
        </div>

        {/* SECTION 4: EVIDENCE STRENGTH DECOMPOSITION */}
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-5 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#172033] font-sans">
                Evidence strength
              </h3>
            </div>

            <div className="text-xs font-mono text-slate-500">
              {isMemoryGrowthObservation
                ? "Not applicable to a memory trend observation"
                : <>Formula: <strong className="text-slate-800">Score = 0.30A + 0.25P + 0.20C + 0.15R + 0.10T</strong></>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-sans">[A] Anomaly Severity (30%)</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">{strength?.A ?? "—"}{strength?.A != null ? "%" : ""}</div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${strength?.A ?? 0}%` }} />
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-sans">[P] Persistence (25%)</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">{strength?.P ?? "—"}{strength?.P != null ? "%" : ""}</div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${strength?.P ?? 0}%` }} />
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-sans">[C] Process Attribution (20%)</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">{strength?.C ?? "—"}{strength?.C != null ? "%" : ""}</div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${strength?.C ?? 0}%` }} />
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-sans">[R] Cross-Resource (15%)</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">{strength?.R ?? "—"}{strength?.R != null ? "%" : ""}</div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${strength?.R ?? 0}%` }} />
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 font-sans">[T] Trend Rate (10%)</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">{strength?.T ?? "—"}{strength?.T != null ? "%" : ""}</div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${strength?.T ?? 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: SAFE ACTION GUIDELINES */}
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Info className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-[#172033] font-sans">
              Safe actions to consider
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 shadow-xs">
              <div className="font-bold text-blue-600 mb-1">CPU Contention</div>
              <p className="text-slate-600 text-[11px] font-sans leading-relaxed">
                Review heavy single-threaded workers. If non-critical, pause or renice the job manually.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 shadow-xs">
              <div className="font-bold text-blue-600 mb-1">Memory Exhaustion</div>
              <p className="text-slate-600 text-[11px] font-sans leading-relaxed">
                Close unnecessary browser tab renderers or restart long-running development watchers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 shadow-xs">
              <div className="font-bold text-amber-600 mb-1">Storage Saturation</div>
              <p className="text-slate-600 text-[11px] font-sans leading-relaxed">
                Allow scheduled package updates or database vacuuming tasks to complete normally.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 shadow-xs">
              <div className="font-bold text-emerald-600 mb-1">Network Burst</div>
              <p className="text-slate-600 text-[11px] font-sans leading-relaxed">
                Correlate socket traffic with file sync utilities and active download streams.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-100">
            SYSTEMOS is non-destructive: it strictly provides diagnostic intelligence and will never terminate processes autonomously.
          </div>
        </div>

        {/* SECTION 6: DEMO SIMULATION DECK */}
        <DemoPanel />
      </main>
    </div>
  );
}
