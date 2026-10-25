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
      <tr className="hover:bg-[#F8FAFC] transition-colors">
        <td className="p-3.5">
          <div className="font-bold text-[#172033]">{application.display_name}</div>
          <div className="mt-1 text-[11px] text-[#667085]">
            {application.is_fallback_label ? "Unidentified · " : ""}
            {application.role.replace(/_/g, " ")}
            {application.is_foreground ? " · foreground window" : " · running in background"}
          </div>
        </td>
        <td className="p-3.5 text-right font-bold text-[#2563EB]">{application.cpu_percent.toFixed(1)}%</td>
        <td className="p-3.5 text-right font-bold text-[#172033]">{memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(2)} GB` : `${memoryMb.toFixed(1)} MB`}</td>
        <td className="p-3.5 text-right font-medium text-[#667085]">{application.memory_percent.toFixed(1)}%</td>
        <td className="p-3.5 text-right font-medium text-[#172033]">{application.process_count}</td>
        <td className="p-3.5">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
            application.is_foreground ? "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]" : "bg-[#F8FAFC] text-[#667085] border-[#E5EAF1]"
          }`}>
            {application.is_foreground ? "Foreground" : "Running"}
          </span>
        </td>
        <td className="p-3.5 text-center">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
          >
            {expanded ? "Hide" : "Inspect"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-[#F8FAFC] px-4 py-3.5 border-y border-[#E5EAF1]">
            <div className="space-y-2">
              {application.processes.map(process => (
                <div key={process.pid} className="grid grid-cols-2 gap-2 rounded-xl bg-white border border-[#E5EAF1] p-3 text-[11px] sm:grid-cols-6 shadow-2xs">
                  <Link href={`/processes/${process.pid}`} className="flex min-w-0 flex-col truncate text-[#2563EB] hover:underline font-semibold" title={process.process_name}>
                    <span className="truncate">{process.display_name || process.process_name}</span>
                    {process.display_name && process.display_name !== process.process_name && (
                      <span className="truncate text-[10px] text-[#98A2B3] font-normal">{process.process_name}</span>
                    )}
                  </Link>
                  <span className="text-[#667085] font-medium">PID {process.pid}</span>
                  <span className="text-[#2563EB] font-bold">{process.cpu_percent.toFixed(1)}% CPU</span>
                  <span className="text-[#172033] font-semibold">{(process.memory_bytes / (1024 * 1024)).toFixed(1)} MB RSS</span>
                  <span className="text-[#667085]">{process.status ?? "Available"}</span>
                  <span className="text-[#98A2B3]">{process.is_foreground ? "Foreground" : `Parent PID ${process.parent_pid ?? "—"}`}</span>
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
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      <TopBar title="Processes and applications" subtitle="Running Activity & Resource Attribution" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8 animate-fade-in-up">
        {/* Header & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-xs font-mono font-bold tracking-wider text-[#2563EB] uppercase">
                Process Intelligence
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033] font-sans">
              Process Analyzer & Recommendations
            </h2>
            <p className="text-sm text-[#667085] font-sans mt-1 max-w-2xl leading-relaxed">
              6-tier canonical process categorization, resource footprint analysis, and explainable human-in-the-loop recommendations.
            </p>
          </div>

          {/* Policy Guardrail Pill */}
          <div className="liquid-glass-badge px-3.5 py-2 text-xs text-[#667085] flex items-center gap-2 shadow-xs">
            <Shield className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span className="font-medium">Zero automated termination. You stay in control.</span>
          </div>
        </div>

        {/* ── Summary Statistics Deck ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="liquid-glass-card-interactive p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#667085] mb-2">
              <span>Processes In Snapshot</span>
              <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#172033]">
              {applicationsData?.total_processes_enumerated ?? summary?.total_analyzed ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-[#98A2B3] mt-1">
              {summary ? `${summary.total_system_processes} system processes enumerated` : "Enumerating accessible processes"}
            </div>
          </div>

          <div className="liquid-glass-card-interactive p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#667085] mb-2">
              <span>High Resource Consumers</span>
              <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#172033]">
              {summary?.high_resource_consumer_count ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-[#98A2B3] mt-1">
              Classified by measured CPU / memory footprint
            </div>
          </div>

          <div className={`liquid-glass-card-interactive p-5 shadow-xs ${summary?.review_candidate_count ? "border-[#FDE68A] bg-[#FFFBEB]/50" : ""}`}>
            <div className={`flex items-center justify-between text-xs font-mono font-bold mb-2 ${summary?.review_candidate_count ? "text-[#D97706]" : "text-[#667085]"}`}>
              <span>Review Candidates</span>
              <div className={`p-1.5 rounded-lg ${summary?.review_candidate_count ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#F1F4F8] text-[#98A2B3]"}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#172033]">
              {summary?.review_candidate_count ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-[#98A2B3] mt-1">
              Evaluated across 4 deterministic sub-rules
            </div>
          </div>

          <div className="liquid-glass-card-interactive p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#667085] mb-2">
              <span>Estimated Reclaimable</span>
              <div className="p-1.5 rounded-lg bg-[#F0FDF4] text-[#16A34A]">
                <MemoryStick className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#16A34A]">
              {potentialReclaimableMb > 0 ? `${potentialReclaimableMb.toFixed(0)} MB` : "0 MB"}
            </div>
            <div className="text-[11px] font-mono text-[#98A2B3] mt-1">
              From {recommendations.length} actionable suggestions
            </div>
          </div>
        </div>

        {/* ── Explainable Recommendations Section ───────────────────────────── */}
        {recommendations.length > 0 && (
          <div className="liquid-glass-card p-6 sm:p-7 space-y-5 shadow-xs border-[#FDE68A] bg-[#FFFBEB]/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#FDE68A]/70 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#D97706]" />
                  <h3 className="text-lg font-bold font-mono text-[#172033]">
                    EXPLAINABLE APPLICATION RECOMMENDATIONS
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                    {recommendations.length} Active
                  </span>
                </div>
                <p className="text-xs font-sans text-[#667085] mt-1">
                  Evidence-based suggestions detailing operational role, resource usage, classification logic, and safe manual remediation.
                </p>
              </div>

              <div className="text-right text-xs font-mono text-[#667085]">
                Potential memory savings: <span className="font-bold text-[#16A34A]">{potentialReclaimableMb.toFixed(1)} MB</span>
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
                    className="bg-white border border-[#E5EAF1] hover:border-[#BFDBFE] rounded-2xl p-5 transition-all shadow-xs space-y-4"
                  >
                    {/* Top Row: Process Name, Category, Badges, Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                            rec.severity === "HIGH"
                              ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                              : "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                          }`}
                        >
                          {rec.severity} Priority
                        </span>

                        <Link
                          href={`/processes/${rec.pid}`}
                          className="font-mono font-bold text-[#172033] hover:text-[#2563EB] flex items-center gap-1.5 text-sm transition-colors"
                        >
                          <span>{rec.display_name || rec.name}</span>
                          {rec.display_name && rec.display_name !== rec.name && (
                            <span className="ml-1 text-xs font-normal text-[#98A2B3]">{rec.name}</span>
                          )}
                          <span className="text-xs text-[#98A2B3]">(PID {rec.pid})</span>
                        </Link>

                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${safety.className}`}>
                          <SafetyIcon className="w-3 h-3" />
                          <span>{safety.text}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-xs font-mono text-[#16A34A] font-bold">
                          Reclaimable: ~{rec.reclaimable_memory_mb} MB
                          {rec.reclaimable_cpu_percent > 0 && ` | ${rec.reclaimable_cpu_percent}% CPU`}
                        </div>

                        <button
                          onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                          className="text-xs font-mono text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] font-semibold transition-colors"
                        >
                          <span>{isExpanded ? "Collapse" : "Explain"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Concise Summary Sentence */}
                    <p className="text-xs font-sans text-[#475569] leading-relaxed">
                      {rec.what_process_is_doing || rec.activity_description}
                    </p>

                    {/* Expanded 7-Dimensional Explainable Evidence Panel */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[#EDF0F5] space-y-4 text-xs font-mono">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              1. Resources Consumed
                            </span>
                            <div className="text-[#172033] glass-well p-3 rounded-xl border border-[#E5EAF1] font-sans">
                              {rec.resources_consumed}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              2. Unusual Usage Assessment
                            </span>
                            <div className="text-[#172033] glass-well p-3 rounded-xl border border-[#E5EAF1] font-sans">
                              {rec.is_usage_unusual}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              3. Classification Reason
                            </span>
                            <div className="text-[#172033] glass-well p-3 rounded-xl border border-[#E5EAF1] font-sans">
                              {rec.classification_reason}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              4. Investigation Guidance
                            </span>
                            <div className="text-[#172033] glass-well p-3 rounded-xl border border-[#E5EAF1] font-sans">
                              {rec.should_investigate || rec.investigation_advice}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              5. Manual Closure Consideration
                            </span>
                            <div className="text-[#172033] glass-well p-3 rounded-xl border border-[#E5EAF1] font-sans">
                              {rec.manual_closure_considered || rec.manual_closure_guidance}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              6. Safety & Uncertainty Considerations
                            </span>
                            <div className="text-[#172033] glass-well p-3 rounded-xl border border-[#E5EAF1] font-sans">
                              {rec.safety_and_uncertainty}
                            </div>
                          </div>
                        </div>

                        {/* Evidence Bullets */}
                        {rec.evidence && rec.evidence.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[11px] uppercase tracking-wider text-[#98A2B3] font-bold">
                              Supporting Telemetry Evidence
                            </span>
                            <ul className="space-y-1 text-[#667085]">
                              {rec.evidence.map((item: string, idx: number) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
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
              <h3 className="text-lg font-bold text-[#172033]">Running Applications & Grouped Processes</h3>
              <p className="text-xs text-[#667085] mt-1">
                Grouped from the latest collector snapshot. CPU is normalized across {applicationsData?.cpu_core_count ?? "—"} logical cores; memory is resident set size (RSS).
              </p>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={applicationSearch}
                onChange={event => setApplicationSearch(event.target.value)}
                placeholder="Search app, executable, or PID"
                className="w-full bg-white border border-[#E5EAF1] rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono text-[#172033] placeholder-[#98A2B3] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#EFF6FF] shadow-2xs transition-all"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB]/50 p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-[#172033]">
                  Idle-Use Review Suggestions (1 Hour Threshold)
                </h4>
                <p className="mt-1 text-xs text-[#667085] leading-relaxed">
                  User applications not observed in the foreground for at least 60 minutes. Prompt for operator manual review; SYSTEMOS will never terminate an application automatically.
                </p>
                {applicationsLoading && !applicationsData ? (
                  <p className="mt-3 text-xs text-[#98A2B3] font-mono">Waiting for foreground activity telemetry…</p>
                ) : applicationsError ? (
                  <p className="mt-3 text-xs text-[#DC2626] font-mono" role="alert">
                    Suggestions unavailable: {applicationsError}
                  </p>
                ) : applicationsData?.collector_age_seconds != null && applicationsData.collector_age_seconds > 60 ? (
                  <p className="mt-3 text-xs text-[#D97706] font-mono" role="alert">
                    Suggestions paused because latest process snapshot is stale. Check that collector is active.
                  </p>
                ) : applicationsData?.idle_suggestions.length ? (
                  <ul className="mt-3 divide-y divide-[#FDE68A]/60">
                    {applicationsData.idle_suggestions.map(suggestion => (
                      <li
                        key={suggestion.application_id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[#172033]">
                            {suggestion.display_name}
                          </div>
                          <div className="mt-1 text-[11px] text-[#667085] font-mono">
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
                          className="self-start rounded-xl border border-[#FDE68A] bg-white px-3 py-1.5 text-xs font-semibold text-[#D97706] hover:bg-[#FFFBEB] sm:self-auto shadow-2xs transition-colors"
                        >
                          Find in running apps
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-[#667085]">
                    No eligible running apps have been observed outside the foreground for over an hour. Activity tracking begins when an application is observed in the foreground.
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
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all duration-200 ${
                  applicationFilter === id
                    ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] font-bold shadow-xs"
                    : "border-[#E5EAF1] bg-white text-[#667085] hover:text-[#172033] hover:bg-[#F8FAFC]"
                }`}
              >
                {label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs font-mono text-[#667085]">
              Sort
              <select
                value={applicationSort}
                onChange={event => setApplicationSort(event.target.value)}
                className="bg-white border border-[#E5EAF1] rounded-xl px-2.5 py-1.5 text-[#172033] outline-none cursor-pointer hover:border-[#BFDBFE] shadow-2xs"
              >
                <option value="cpu_percent">CPU Allocation</option>
                <option value="memory_bytes">Memory Footprint</option>
              </select>
            </label>
          </div>

          <div className="liquid-glass-card rounded-2xl overflow-hidden shadow-xs border border-[#E5EAF1]">
            {applicationsError ? (
              <div className="p-6 text-sm text-[#DC2626] font-mono" role="alert">
                Could not load the latest process snapshot: {applicationsError}
              </div>
            ) : applicationsLoading && !applicationsData ? (
              <div className="p-8 text-center text-sm text-[#98A2B3] font-mono">Waiting for process snapshot…</div>
            ) : applicationsData?.collector_age_seconds != null && applicationsData.collector_age_seconds > 60 ? (
              <div className="p-6 text-sm text-[#D97706] font-mono" role="alert">
                Process data is stale ({Math.round(applicationsData.collector_age_seconds)}s old). Check that backend collector is running.
              </div>
            ) : visibleApplications.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#667085] font-mono">
                {applicationsData?.timestamp == null ? "No process snapshot has been collected yet." : "No applications match these filters."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs font-mono">
                  <thead className="bg-[#F8FAFC] text-[#667085] border-b border-[#E5EAF1]">
                    <tr>
                      <th className="text-left p-3.5 font-bold">Application</th>
                      <th className="text-right p-3.5 font-bold">CPU</th>
                      <th className="text-right p-3.5 font-bold">Memory</th>
                      <th className="text-right p-3.5 font-bold">Memory %</th>
                      <th className="text-right p-3.5 font-bold">Processes</th>
                      <th className="text-left p-3.5 font-bold">Status</th>
                      <th className="p-3.5 text-center font-bold">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF0F5]">
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
          <p className="text-[11px] text-[#98A2B3] font-mono">
            Snapshot: {applicationsData?.timestamp ? new Date(applicationsData.timestamp * 1000).toLocaleTimeString() : "not available"} · {applicationsData?.total_processes_enumerated ?? 0} accessible processes enumerated
          </p>
        </section>

        {/* ── Category Filter Tabs + Search Controls ──────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F1F4F8] border border-[#E5EAF1] p-1.5 rounded-2xl shadow-2xs">
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
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 ${
                    active
                      ? "bg-white text-[#2563EB] font-bold border border-[#BFDBFE] shadow-xs"
                      : "text-[#667085] hover:text-[#172033] hover:bg-white/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {count != null && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        active ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-white/80 text-[#98A2B3]"
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
              <Search className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search processes by name, PID, or parent..."
                className="bg-white border border-[#E5EAF1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#EFF6FF] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-[#172033] placeholder-[#98A2B3] outline-none w-full shadow-2xs transition-all"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[#667085]">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-white border border-[#E5EAF1] text-[#172033] text-xs font-mono rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:border-[#BFDBFE] shadow-2xs"
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
        <div className="liquid-glass-card rounded-2xl overflow-hidden shadow-xs border border-[#E5EAF1]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#E5EAF1] bg-[#F8FAFC] text-[#667085]">
                  <th className="text-left py-3.5 px-5 font-bold">Process & Lineage</th>
                  <th className="text-left py-3.5 px-4 font-bold">Classification</th>
                  <th className="text-left py-3.5 px-4 font-bold">Safety Level</th>
                  <th className="text-left py-3.5 px-5 font-bold w-48">CPU Allocation</th>
                  <th className="text-right py-3.5 px-4 font-bold">Resident RAM</th>
                  <th className="text-center py-3.5 px-3 font-bold">Sockets</th>
                  <th className="text-right py-3.5 px-4 font-bold">Duration</th>
                  <th className="py-3.5 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0F5]">
                {analyzerLoading && rawProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[#98A2B3] font-mono">
                      Polling operating system process snapshots and telemetry...
                    </td>
                  </tr>
                ) : analyzerError && rawProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[#D97706] font-mono">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-[#D97706]" />
                        <span className="font-semibold">Telemetry temporarily unavailable: {analyzerError}</span>
                        <span className="text-xs text-[#98A2B3]">Retrying live process telemetry in 3.5s...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[#667085] font-mono">
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
                        className="h-14 hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                      >
                        {/* Process Name + Parent */}
                        <td className="py-3.5 px-5 max-w-xs truncate">
                          <Link
                            href={`/processes/${p.pid}`}
                            className="hover:text-[#2563EB] flex flex-col group-hover:underline transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#172033] truncate">{p.display_name || p.name}</span>
                              <span className="text-[11px] text-[#98A2B3] font-medium">#{p.pid}</span>
                              {p.is_foreground && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] uppercase font-bold">
                                  Focus
                                </span>
                              )}
                            </div>
                            {p.display_name && p.display_name !== p.name && (
                              <span className="text-[10px] text-[#98A2B3] truncate">{p.name}</span>
                            )}
                            {p.parent_name && (
                              <span className="text-[10px] text-[#98A2B3] truncate">
                                Parent: {p.parent_name}
                              </span>
                            )}
                          </Link>
                        </td>

                        {/* Classification Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-2xs ${classBadge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${classBadge.dot}`} />
                            <span className="truncate">{classBadge.label}</span>
                          </span>
                        </td>

                        {/* Safety Tier Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${safety.className}`}
                          >
                            <SafetyIcon className="w-3 h-3" />
                            <span>{safety.text}</span>
                          </span>
                        </td>

                        {/* CPU Bar + Value */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-[#E5EAF1] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isHighCpu ? "bg-[#DC2626]" : isElevatedCpu ? "bg-[#D97706]" : "bg-[#2563EB]"
                                }`}
                                style={{ width: `${Math.min(cpu, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`w-12 text-right font-bold ${
                                isHighCpu
                                  ? "text-[#DC2626]"
                                  : isElevatedCpu
                                  ? "text-[#D97706]"
                                  : "text-[#172033]"
                              }`}
                            >
                              {formatPct(p.cpu_percent)}
                            </span>
                          </div>
                        </td>

                        {/* Memory RSS */}
                        <td className="py-3.5 px-4 text-[#172033] text-right font-bold">
                          {memMb >= 1000 ? `${(memMb / 1024).toFixed(2)} GB` : `${memMb.toFixed(1)} MB`}
                        </td>

                        {/* Sockets */}
                        <td className="py-3.5 px-3 text-center text-[#667085]">
                          {p.open_connections > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[#2563EB] font-bold">
                              <Network className="w-3 h-3" />
                              <span>{p.open_connections}</span>
                            </span>
                          ) : (
                            <span className="text-[#CBD5E1]">—</span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-3.5 px-4 text-[#667085] text-right">
                          <span className="flex items-center justify-end gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-[#98A2B3]" />
                            <span>{formatDuration(p.runtime_seconds)}</span>
                          </span>
                        </td>

                        {/* Details Link */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/processes/${p.pid}`}
                            className="p-1.5 rounded-lg text-[#98A2B3] hover:text-[#2563EB] hover:bg-[#EFF6FF] inline-flex transition-colors"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-[#98A2B3] px-1 gap-2">
          <span>Active telemetry refreshed via SQLite snapshots & Win32 RPCs</span>
          <span>
            Showing {filtered.length} of {rawProcesses.length} monitored entities
          </span>
        </div>
      </main>
    </div>
  );
}
