"use client";
import { useState, useMemo } from "react";
import TopBar from "@/components/layout/TopBar";
import { useProcessAnalyzer, useProcessRecommendations } from "@/hooks/useProcesses";
import { formatPct, formatBytes } from "@/lib/utils";
import Link from "next/link";
import PipelineHealthSection from "@/components/health/PipelineHealthSection";
import {
  Cpu,
  MemoryStick,
  Search,
  ChevronRight,
  Layers,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
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
import type { ProcessProfile, ProcessRecommendation } from "@/types";

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
        bg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
        dot: "bg-purple-400",
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
        className: "text-purple-300 bg-purple-950/40 border-purple-800/40",
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

export default function ProcessesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("cpu_percent");
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

  const { data: analyzerData, loading: analyzerLoading, error: analyzerError } = useProcessAnalyzer({
    sortBy,
    limit: 120,
    pollMs: 3500,
  });

  const { recommendations, potentialReclaimableMb, loading: recsLoading } = useProcessRecommendations(15, 4000);

  const summary = analyzerData?.summary;
  const rawProcesses: ProcessProfile[] = analyzerData?.processes ?? [];

  const filtered = useMemo(() => {
    let procs = rawProcesses;
    if (activeCategory !== "all") {
      procs = procs.filter(
        p => p.activity_class === activeCategory || p.activity_key === activeCategory
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      procs = procs.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          String(p.pid).includes(q) ||
          (p.parent_name && p.parent_name.toLowerCase().includes(q))
      );
    }
    return procs;
  }, [rawProcesses, activeCategory, search]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
      <TopBar title="Process Analyzer" subtitle="Explainable Classification & Recommendations" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Phase 3 Engine Active
              </span>
              <span className="text-xs font-mono text-slate-500">Local Telemetry + Win32 Profiling</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
              PROCESS ACTIVITY & RECOMMENDATIONS
            </h2>
            <p className="text-sm text-slate-400 font-sans mt-1 max-w-2xl">
              Explainable, rule-based classification across 6 behavioral tiers with deterministic evidence,
              resource baselines, and safe manual review suggestions.
            </p>
          </div>

          {/* Policy Guardrail Pill */}
          <div className="bg-[#111726] border border-amber-500/20 px-3 py-2 rounded-lg text-[11px] font-mono text-amber-300/90 flex items-center gap-2 max-w-md">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Guaranteed Safety:</strong> SYSTEMOS never automatically terminates processes.
            </span>
          </div>
        </div>

        {/* ── Summary Statistics Deck ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>Tracked Processes</span>
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {summary?.total_analyzed ?? "—"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Host Total: {summary?.total_system_processes ?? "—"} PIDs
            </div>
          </div>

          <div className="bg-[#111726] border border-rose-500/20 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-rose-400 mb-2">
              <span>High Resource Consumers</span>
              <Zap className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-300">
              {summary?.high_resource_consumer_count ?? 0}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Sustained CPU/RAM/Disk hogs
            </div>
          </div>

          <div className="bg-[#111726] border border-amber-500/20 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-amber-400 mb-2">
              <span>Review Candidates</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300">
              {summary?.review_candidate_count ?? 0}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Dormant bloat / memory growth
            </div>
          </div>

          <div className="bg-[#111726] border border-emerald-500/20 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-emerald-400 mb-2">
              <span>Potential Reclaimable RAM</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-300">
              {potentialReclaimableMb > 0 ? `${potentialReclaimableMb.toFixed(0)} MB` : "0 MB"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              From {recommendations.length} actionable suggestions
            </div>
          </div>
        </div>

        {/* ── Explainable Recommendations Section ───────────────────────────── */}
        {recommendations.length > 0 && (
          <div className="bg-[#111726] border border-amber-500/30 rounded-xl p-6 sm:p-7 space-y-5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
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
                    className="bg-[#0d1322] border border-[#1e293b] hover:border-slate-700/80 rounded-lg p-5 transition-all space-y-4"
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
                          <span>{rec.name}</span>
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
                      <div className="mt-4 pt-4 border-t border-[#1e293b] space-y-4 text-xs font-mono">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              1. Resources Consumed
                            </span>
                            <div className="text-slate-200 bg-[#111726] p-2.5 rounded border border-[#1e293b]">
                              {rec.resources_consumed}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              2. Unusual Usage Assessment
                            </span>
                            <div className="text-slate-200 bg-[#111726] p-2.5 rounded border border-[#1e293b]">
                              {rec.is_usage_unusual}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              3. Classification Reason
                            </span>
                            <div className="text-slate-200 bg-[#111726] p-2.5 rounded border border-[#1e293b]">
                              {rec.classification_reason}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              4. Investigation Guidance
                            </span>
                            <div className="text-slate-200 bg-[#111726] p-2.5 rounded border border-[#1e293b]">
                              {rec.should_investigate || rec.investigation_advice}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              5. Manual Closure Consideration
                            </span>
                            <div className="text-slate-200 bg-[#111726] p-2.5 rounded border border-[#1e293b]">
                              {rec.manual_closure_considered || rec.manual_closure_guidance}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                              6. Safety & Uncertainty Considerations
                            </span>
                            <div className="text-slate-200 bg-[#111726] p-2.5 rounded border border-[#1e293b]">
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

        {/* ── Category Filter Tabs + Search Controls ──────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#111726] border border-[#1e293b] p-1.5 rounded-xl">
            {CATEGORY_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeCategory === tab.id;
              const count =
                tab.id === "all"
                  ? summary?.total_analyzed
                  : (summary as any)?.[tab.countKey] ?? 0;

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
                className="bg-[#111726] border border-[#1e293b] focus:border-sky-500/50 rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none w-full transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-[#111726] border border-[#1e293b] text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-slate-700"
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
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#0d1322] text-slate-400">
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
              <tbody className="divide-y divide-[#1e293b]/60">
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
                      No matching processes discovered in category '{activeCategory}'.
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
                              <span className="font-semibold text-slate-200 truncate">{p.name}</span>
                              <span className="text-[11px] text-slate-500">#{p.pid}</span>
                              {p.is_foreground && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase font-bold">
                                  Focus
                                </span>
                              )}
                            </div>
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
