"use client";
import { useState, useMemo } from "react";
import TopBar from "@/components/layout/TopBar";
import { useProcessAnalyzer } from "@/hooks/useProcesses";
import { useApplications } from "@/hooks/useApplications";
import { formatPct } from "@/lib/utils";
import Link from "next/link";
import PipelineHealthSection from "@/components/health/PipelineHealthSection";
import {
  MemoryStick,
  Search,
  ChevronRight,
  Layers,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Terminal,
  Activity,
  Zap,
  Clock,
  Network,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import type { ApplicationGroup, ProcessAnalyzerSummary, ProcessProfile } from "@/types";

const CATEGORY_TABS = [
  { id: "all", label: "All Monitored", countKey: "total_analyzed", icon: Layers },
  { id: "Active application", label: "Active Applications", countKey: "active_application_count", icon: Activity },
  { id: "High resource consumer", label: "High Resource", countKey: "high_resource_consumer_count", icon: Zap },
  { id: "Review candidate", label: "Review Candidates", countKey: "review_candidate_count", icon: AlertTriangle },
  { id: "Background process", label: "Background", countKey: "background_process_count", icon: Terminal },
  { id: "Protected/system process", label: "Protected System", countKey: "protected_system_count", icon: Shield },
  { id: "Insufficient information", label: "Inaccessible", countKey: "insufficient_information_count", icon: HelpCircle },
];

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
        bg: "bg-sky-500/10 text-sky-300 border-sky-500/25",
        dot: "bg-sky-400",
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

function ApplicationRows({
  application,
  expanded,
  memoryMb,
  onToggle,
}: {
  application: ApplicationGroup;
  expanded: boolean;
  memoryMb: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-slate-800/40">
        <td className="p-3">
          <div className="font-semibold text-slate-100">{application.display_name}</div>
          <div className="mt-1 text-[10px] text-slate-500">
            {application.is_fallback_label ? "Unidentified · " : ""}
            {application.role.replace(/_/g, " ")}
            {application.is_foreground ? " · foreground window" : " · running in background"}
          </div>
        </td>
        <td className="p-3 text-right text-sky-300">{application.cpu_percent.toFixed(1)}%</td>
        <td className="p-3 text-right text-slate-200">{memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(2)} GB` : `${memoryMb.toFixed(1)} MB`}</td>
        <td className="p-3 text-right text-slate-300">{application.memory_percent.toFixed(1)}%</td>
        <td className="p-3 text-right text-slate-300">{application.process_count}</td>
        <td className="p-3 text-slate-400">{application.is_foreground ? "Foreground" : "Running"}</td>
        <td className="p-3 text-center">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="text-sky-300 hover:text-sky-100"
          >
            {expanded ? "Hide" : "Inspect"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-[#11171f] px-4 py-3">
            <div className="space-y-2">
              {application.processes.map(process => (
                <div key={process.pid} className="grid grid-cols-2 gap-2 rounded border border-[#29323d] p-3 text-[11px] sm:grid-cols-6">
                  <Link href={`/processes/${process.pid}`} className="flex min-w-0 flex-col truncate text-sky-300 hover:text-sky-100" title={process.process_name}>
                    <span className="truncate">{process.display_name || process.process_name}</span>
                    {process.display_name && process.display_name !== process.process_name && (
                      <span className="truncate text-[10px] text-slate-500">{process.process_name}</span>
                    )}
                  </Link>
                  <span className="text-slate-400">PID {process.pid}</span>
                  <span className="text-slate-300">{process.cpu_percent.toFixed(1)}% CPU</span>
                  <span className="text-slate-300">{(process.memory_bytes / (1024 * 1024)).toFixed(1)} MB RSS</span>
                  <span className="text-slate-400">{process.status ?? "Unavailable"}</span>
                  <span className="text-slate-500">{process.is_foreground ? "Foreground" : `Parent PID ${process.parent_pid ?? "—"}`}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ProcessesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("cpu_percent");
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationSort, setApplicationSort] = useState("cpu_percent");

  const { data: analyzerData, loading: analyzerLoading, error: analyzerError } = useProcessAnalyzer({
    sortBy,
    limit: 120,
    pollMs: 30000,
  });

  const {
    data: applicationsData,
    loading: applicationsLoading,
    error: applicationsError,
  } = useApplications({
    sortBy: applicationSort,
    limit: 300,
    pollMs: 3000,
  });

  const summary = analyzerData?.summary;
  const rawProcesses: ProcessProfile[] = useMemo(() => analyzerData?.processes ?? [], [analyzerData?.processes]);
  const recommendations = analyzerData?.recommendations ?? [];
  const potentialReclaimableMb = summary?.potential_reclaimable_memory_mb ?? 0;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rawProcesses
      .filter(process =>
        (activeCategory === "all" || process.activity_class === activeCategory) &&
        (!query ||
          process.name.toLowerCase().includes(query) ||
          String(process.pid).includes(query) ||
          (process.parent_name ?? "").toLowerCase().includes(query))
      )
      .sort((left, right) => {
        const leftValue = left[sortBy as keyof ProcessProfile];
        const rightValue = right[sortBy as keyof ProcessProfile];
        return Number(rightValue ?? 0) - Number(leftValue ?? 0);
      });
  }, [rawProcesses, activeCategory, search, sortBy]);

  const visibleApplications = useMemo(() => (applicationsData?.applications ?? []).filter(application => {
    const matchesRole =
      applicationFilter === "all" ||
      (applicationFilter === "foreground" && application.is_foreground) ||
      (applicationFilter === "background" && !application.is_foreground && !["system", "service", "monitor_runtime"].includes(application.role)) ||
      (applicationFilter === "system" && ["system", "service", "protected_system_process"].includes(application.role));
    const query = applicationSearch.trim().toLowerCase();
    const matchesSearch = !query ||
      application.display_name.toLowerCase().includes(query) ||
      application.processes.some(process =>
        process.process_name.toLowerCase().includes(query) ||
        String(process.pid).includes(query)
      );
    return matchesRole && matchesSearch;
  }).sort((left, right) => {
    if (applicationSort === "memory_bytes") return right.memory_bytes - left.memory_bytes;
    return right.cpu_percent - left.cpu_percent;
  }), [applicationsData, applicationFilter, applicationSearch, applicationSort]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
      <TopBar title="Processes and applications" subtitle="Running activity and resource use" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-300 border border-slate-700">
                Live process data
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
              Processes and recommendations
            </h2>
            <p className="text-sm text-slate-400 font-sans mt-1 max-w-2xl">
              See which applications are running, how much resource they use, and which items may be worth a closer look.
            </p>
          </div>

          {/* Policy Guardrail Pill */}
          <div className="bg-[#151b23] border border-[#29323d] px-3 py-2 rounded-lg text-xs text-slate-400 flex items-center gap-2 max-w-md">
            <Shield className="w-4 h-4 text-slate-500 shrink-0" />
            <span>No automatic actions. You stay in control.</span>
          </div>
        </div>

        {/* ── Summary Statistics Deck ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>Processes in latest snapshot</span>
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {applicationsData?.total_processes_enumerated ?? summary?.total_analyzed ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              {summary ? `${summary.total_system_processes} system processes detected` : "Counting accessible processes"}
            </div>
          </div>

          <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>Resource-intensive processes</span>
              <Zap className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {summary?.high_resource_consumer_count ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Currently classified by measured resource use
            </div>
          </div>

          <div className={`bg-[#151b23] border rounded-xl p-5 shadow-sm ${summary?.review_candidate_count ? "border-amber-500/20" : "border-[#29323d]"}`}>
            <div className={`flex items-center justify-between text-xs font-mono mb-2 ${summary?.review_candidate_count ? "text-amber-400" : "text-slate-400"}`}>
              <span>Patterns to review</span>
              <AlertTriangle className={`w-4 h-4 ${summary?.review_candidate_count ? "text-amber-400" : "text-slate-500"}`} />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {summary?.review_candidate_count ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Based on measured process behavior
            </div>
          </div>

          <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>Estimated reclaimable memory</span>
              <MemoryStick className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {potentialReclaimableMb > 0 ? `${potentialReclaimableMb.toFixed(0)} MB` : "0 MB"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              From {recommendations.length} actionable suggestions
            </div>
          </div>
        </div>

        {/* ── Explainable Recommendations Section ───────────────────────────── */}
        {recommendations.length > 0 && (
          <div className="bg-[#151b23] border border-amber-500/30 rounded-xl p-6 sm:p-7 space-y-5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#29323d] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-lg font-bold font-mono text-slate-100">
                    EXPLAINABLE APPLICATION RECOMMENDATIONS
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {recommendations.length} Active
                  </span>
                </div>
                <p className="text-xs font-sans text-slate-400 mt-1">
                  Evidence-based suggestions explaining process behavior, resource impact, unusual patterns, and safe manual actions.
                </p>
              </div>

              <div className="text-right text-xs font-mono text-slate-400">
                Potential memory savings: <span className="font-bold text-emerald-400">{potentialReclaimableMb.toFixed(1)} MB</span>
              </div>
            </div>

            {/* Recommendation Cards */}
            <div className="space-y-4">
              {recommendations.map(rec => {
                const isExpanded = expandedRecId === rec.id;
                const safety = getSafetyBadge(rec.safety_tier);
                const SafetyIcon = safety.icon;

                return (
                  <div
                    key={rec.id}
                    className="bg-[#11171f] border border-[#29323d] hover:border-slate-700/80 rounded-lg p-5 transition-all space-y-4"
                  >
                    {/* Top Row: Process Name, Category, Badges, Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            rec.severity === "HIGH"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }`}
                        >
                          {rec.severity} Priority
                        </span>

                        <Link
                          href={`/processes/${rec.pid}`}
                          className="font-mono font-bold text-slate-100 hover:text-sky-400 flex items-center gap-1.5 text-sm"
                        >
                          <span>{rec.display_name || rec.name}</span>
                          {rec.display_name && rec.display_name !== rec.name && (
                            <span className="ml-2 text-xs font-normal text-slate-500">{rec.name}</span>
                          )}
                          <span className="text-xs text-slate-500">(PID {rec.pid})</span>
                        </Link>

                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${safety.className}`}>
                          <SafetyIcon className="w-3 h-3" />
                          <span>{safety.text}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-xs font-mono text-emerald-400 font-semibold">
                          Reclaimable: ~{rec.reclaimable_memory_mb} MB
                          {rec.reclaimable_cpu_percent > 0 && ` | ${rec.reclaimable_cpu_percent}% CPU`}
                        </div>

                        <button
                          onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                          className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 transition-colors"
                        >
                          <span>{isExpanded ? "Collapse" : "Explain"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Concise Summary Sentence */}
                    <p className="text-xs font-mono text-slate-300">
                      {rec.what_process_is_doing || rec.activity_description}
                    </p>

                    {/* Expanded 7-Dimensional Explainable Evidence Panel */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[#29323d] space-y-4 text-xs font-mono">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              1. Resources Consumed
                            </span>
                            <div className="text-slate-200 bg-[#151b23] p-2.5 rounded border border-[#29323d]">
                              {rec.resources_consumed}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              2. Unusual Usage Assessment
                            </span>
                            <div className="text-slate-200 bg-[#151b23] p-2.5 rounded border border-[#29323d]">
                              {rec.is_usage_unusual}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              3. Classification Reason
                            </span>
                            <div className="text-slate-200 bg-[#151b23] p-2.5 rounded border border-[#29323d]">
                              {rec.classification_reason}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              4. Investigation Guidance
                            </span>
                            <div className="text-slate-200 bg-[#151b23] p-2.5 rounded border border-[#29323d]">
                              {rec.should_investigate || rec.investigation_advice}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              5. Manual Closure Consideration
                            </span>
                            <div className="text-slate-200 bg-[#151b23] p-2.5 rounded border border-[#29323d]">
                              {rec.manual_closure_considered || rec.manual_closure_guidance}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              6. Safety & Uncertainty Considerations
                            </span>
                            <div className="text-slate-200 bg-[#151b23] p-2.5 rounded border border-[#29323d]">
                              {rec.safety_and_uncertainty}
                            </div>
                          </div>
                        </div>

                        {/* Evidence Bullets */}
                        {rec.evidence && rec.evidence.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              Supporting Telemetry Evidence
                            </span>
                            <ul className="space-y-1 text-slate-400">
                              {rec.evidence.map((item: string, idx: number) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400/70 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Running Applications & Processes</h3>
              <p className="text-xs text-slate-400 mt-1">
                Grouped from the latest collector snapshot. CPU is normalized across {applicationsData?.cpu_core_count ?? "—"} logical cores; memory is resident set size.
              </p>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={applicationSearch}
                onChange={event => setApplicationSearch(event.target.value)}
                placeholder="Search app, executable, or PID"
                className="w-full bg-[#151b23] border border-[#29323d] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-sky-500/50"
              />
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-100">
                  Idle-use review suggestions (1 hour)
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  User apps not observed in the foreground for at least an hour. Consider closing one only if you no longer need it; SYSTEMOS will never close it for you.
                </p>
                {applicationsLoading && !applicationsData ? (
                  <p className="mt-3 text-xs text-slate-500">Waiting for foreground activity data…</p>
                ) : applicationsError ? (
                  <p className="mt-3 text-xs text-amber-300" role="alert">
                    Suggestions unavailable: {applicationsError}
                  </p>
                ) : applicationsData?.collector_age_seconds != null && applicationsData.collector_age_seconds > 60 ? (
                  <p className="mt-3 text-xs text-amber-300" role="alert">
                    Suggestions paused because the latest process snapshot is stale. Check that the collector is running.
                  </p>
                ) : applicationsData?.idle_suggestions.length ? (
                  <ul className="mt-3 divide-y divide-[#29323d]">
                    {applicationsData.idle_suggestions.map(suggestion => (
                      <li
                        key={suggestion.application_id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-amber-100">
                            {suggestion.display_name}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            Last observed in foreground {formatDuration(suggestion.idle_seconds)} ago
                            {" · "}{suggestion.process_count} process{suggestion.process_count === 1 ? "" : "es"}
                            {" · "}{(suggestion.memory_bytes / (1024 * 1024)).toFixed(0)} MB resident memory
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setApplicationFilter("all");
                            setApplicationSearch(suggestion.display_name);
                          }}
                          className="self-start rounded border border-amber-500/25 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/10 sm:self-auto"
                        >
                          Find in running apps
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    No eligible running apps have been observed outside the foreground for an hour. Activity tracking begins when the collector observes an app in the foreground.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              ["all", "All applications"],
              ["foreground", "Foreground"],
              ["background", "Background"],
              ["system", "System processes"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setApplicationFilter(id)}
                className={`px-3 py-1.5 rounded-md border text-xs font-mono ${
                  applicationFilter === id
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                    : "border-[#29323d] text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              Sort
              <select
                value={applicationSort}
                onChange={event => setApplicationSort(event.target.value)}
                className="bg-[#151b23] border border-[#29323d] rounded-md px-2 py-1.5 text-slate-200"
              >
                <option value="cpu_percent">CPU</option>
                <option value="memory_bytes">Memory</option>
              </select>
            </label>
          </div>

          <div className="bg-[#151b23] border border-[#29323d] rounded-xl overflow-hidden">
            {applicationsError ? (
              <div className="p-6 text-sm text-amber-300" role="alert">
                Could not load the latest process snapshot: {applicationsError}
              </div>
            ) : applicationsLoading && !applicationsData ? (
              <div className="p-8 text-center text-sm text-slate-400">Waiting for process snapshot…</div>
            ) : applicationsData?.collector_age_seconds != null && applicationsData.collector_age_seconds > 60 ? (
              <div className="p-6 text-sm text-amber-300" role="alert">
                Process data is stale ({Math.round(applicationsData.collector_age_seconds)}s old). Check that the backend collector is running.
              </div>
            ) : visibleApplications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                {applicationsData?.timestamp == null ? "No process snapshot has been collected yet." : "No applications match these filters."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs font-mono">
                  <thead className="bg-[#11171f] text-slate-400">
                    <tr className="border-b border-[#29323d]">
                      <th className="text-left p-3">Application</th>
                      <th className="text-right p-3">CPU</th>
                      <th className="text-right p-3">Memory</th>
                      <th className="text-right p-3">Memory %</th>
                      <th className="text-right p-3">Processes</th>
                      <th className="text-left p-3">Status</th>
                      <th className="p-3">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#29323d]/60">
                    {visibleApplications.map(application => {
                      const expanded = expandedApplicationId === application.application_id;
                      const memoryMb = application.memory_bytes / (1024 * 1024);
                      return (
                        <ApplicationRows
                          key={application.application_id}
                          application={application}
                          expanded={expanded}
                          memoryMb={memoryMb}
                          onToggle={() => setExpandedApplicationId(expanded ? null : application.application_id)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Snapshot: {applicationsData?.timestamp ? new Date(applicationsData.timestamp * 1000).toLocaleTimeString() : "not available"} · {applicationsData?.total_processes_enumerated ?? 0} accessible processes enumerated
          </p>
        </section>

        {/* ── Category Filter Tabs + Search Controls ──────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#151b23] border border-[#29323d] p-1.5 rounded-xl">
            {CATEGORY_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeCategory === tab.id;
              const count =
                tab.id === "all"
                  ? summary?.total_analyzed
                  : summary?.[tab.countKey as keyof ProcessAnalyzerSummary] ?? 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                    active
                      ? "bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {count != null && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] ${
                        active ? "bg-sky-500/30 text-sky-300" : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Bar + Sort Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search processes by name, PID, or parent..."
                className="bg-[#151b23] border border-[#29323d] focus:border-sky-500/50 rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none w-full transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-[#151b23] border border-[#29323d] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-slate-700"
              >
                <option value="cpu_percent">CPU Allocation</option>
                <option value="memory_mb">Physical Memory (MB)</option>
                <option value="runtime_seconds">Process Duration</option>
                <option value="open_connections">Open Sockets</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Process Matrix Table ────────────────────────────────────────────── */}
        <div className="bg-[#151b23] border border-[#29323d] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#29323d] bg-[#11171f] text-slate-400">
                  <th className="text-left py-3.5 px-5 font-semibold">Process & Lineage</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Classification</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Safety Level</th>
                  <th className="text-left py-3.5 px-5 font-semibold w-48">CPU Allocation</th>
                  <th className="text-right py-3.5 px-4 font-semibold">Resident RAM</th>
                  <th className="text-center py-3.5 px-3 font-semibold">Sockets</th>
                  <th className="text-right py-3.5 px-4 font-semibold">Duration</th>
                  <th className="py-3.5 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#29323d]/60">
                {analyzerLoading && rawProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500 font-mono">
                      Polling operating system process snapshots and telemetry...
                    </td>
                  </tr>
                ) : analyzerError && rawProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-amber-400 font-mono">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span>Telemetry temporarily unavailable: {analyzerError}</span>
                        <span className="text-xs text-slate-500">Retrying live process telemetry in 3.5s...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500 font-mono">
                      No matching processes discovered in category &apos;{activeCategory}&apos;.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, i) => {
                    const cpu = p.cpu_percent ?? 0;
                    const memMb = p.memory_mb ?? 0;
                    const isHighCpu = cpu > 40;
                    const isElevatedCpu = cpu > 15;
                    const classBadge = getClassBadge(p.activity_class);
                    const safety = getSafetyBadge(p.safety_tier);
                    const SafetyIcon = safety.icon;

                    return (
                      <tr
                        key={`${p.pid}-${i}`}
                        className="h-14 hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      >
                        {/* Process Name + Parent */}
                        <td className="py-3.5 px-5 max-w-xs truncate">
                          <Link
                            href={`/processes/${p.pid}`}
                            className="hover:text-sky-400 flex flex-col group-hover:underline"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200 truncate">{p.display_name || p.name}</span>
                              <span className="text-[11px] text-slate-500">#{p.pid}</span>
                              {p.is_foreground && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase font-bold">
                                  Focus
                                </span>
                              )}
                            </div>
                            {p.display_name && p.display_name !== p.name && (
                              <span className="text-[10px] text-slate-500 truncate">{p.name}</span>
                            )}
                            {p.parent_name && (
                              <span className="text-[10px] text-slate-500 truncate">
                                Parent: {p.parent_name}
                              </span>
                            )}
                          </Link>
                        </td>

                        {/* Classification Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${classBadge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${classBadge.dot}`} />
                            <span className="truncate">{classBadge.label}</span>
                          </span>
                        </td>

                        {/* Safety Tier Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border ${safety.className}`}
                          >
                            <SafetyIcon className="w-3 h-3" />
                            <span>{safety.text}</span>
                          </span>
                        </td>

                        {/* CPU Bar + Value */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isHighCpu ? "bg-rose-500" : isElevatedCpu ? "bg-amber-400" : "bg-sky-400"
                                }`}
                                style={{ width: `${Math.min(cpu, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`w-12 text-right font-bold ${
                                isHighCpu
                                  ? "text-rose-400"
                                  : isElevatedCpu
                                  ? "text-amber-400"
                                  : "text-slate-300"
                              }`}
                            >
                              {formatPct(p.cpu_percent)}
                            </span>
                          </div>
                        </td>

                        {/* Memory RSS */}
                        <td className="py-3.5 px-4 text-slate-300 text-right font-semibold">
                          {memMb >= 1000 ? `${(memMb / 1024).toFixed(2)} GB` : `${memMb.toFixed(1)} MB`}
                        </td>

                        {/* Sockets */}
                        <td className="py-3.5 px-3 text-center text-slate-400">
                          {p.open_connections > 0 ? (
                            <span className="inline-flex items-center gap-1 text-sky-400">
                              <Network className="w-3 h-3" />
                              <span>{p.open_connections}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-3.5 px-4 text-slate-400 text-right">
                          <span className="flex items-center justify-end gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{formatDuration(p.runtime_seconds)}</span>
                          </span>
                        </td>

                        {/* Details Link */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/processes/${p.pid}`}
                            className="p-1 rounded text-slate-500 hover:text-sky-400 inline-flex transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pipeline Health Section ── */}
        <PipelineHealthSection />

        {/* Footer Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-slate-500 px-1 gap-2">
          <span>Active telemetry refreshed every 3.5s via SQLite snapshots & Win32 RPCs</span>
          <span>
            Showing {filtered.length} of {rawProcesses.length} monitored entities
          </span>
        </div>
      </main>
    </div>
  );
}
