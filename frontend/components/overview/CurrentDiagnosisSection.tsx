"use client";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, ArrowRight, Cpu, Clock } from "lucide-react";
import type { DiagnosisEvent } from "@/types";
import { formatDateTime, formatDuration } from "@/lib/utils";

interface CurrentDiagnosisSectionProps {
  activeEvent: DiagnosisEvent | null | undefined;
  loading?: boolean;
}

export default function CurrentDiagnosisSection({ activeEvent, loading }: CurrentDiagnosisSectionProps) {
  if (loading && !activeEvent) {
    return (
      <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-7 flex items-center justify-center text-slate-400 font-mono text-xs">
        Evaluating live statistical pipeline...
      </div>
    );
  }

  // When no active bottleneck event
  if (!activeEvent) {
    return (
      <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-400">
                System status
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Normal
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-100 mt-1">
              No sustained abnormal behaviour detected.
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              All monitored system resources are currently operating within expected dynamic baseline bounds. Telemetry is being continuously recorded to local SQLite storage.
            </p>
          </div>
        </div>

        <Link
          href="/diagnostics"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium font-mono border border-slate-700 transition-colors shrink-0 self-start sm:self-center"
        >
          Diagnostic Rules <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  // When an active bottleneck is diagnosed
  const evidence = activeEvent.evidence;
  const items = evidence?.evidence_items ?? [];
  const rawStats = evidence?.raw_stats ?? {};
  const isMemoryGrowthObservation =
    rawStats.rule_id === "E" ||
    /memory growth|memory increase observed/i.test(activeEvent.probable_cause);
  const strength = evidence?.evidence_strength?.score ?? null;
  const isHigh = activeEvent.severity === "HIGH";

  return (
    <div className={`bg-[#151b23] border ${
      isMemoryGrowthObservation ? "border-sky-500/30" : isHigh ? "border-rose-500/40" : "border-amber-500/30"
    } rounded-xl p-7 space-y-6 shadow-sm`}>
      {/* Top row: 3-column diagnostic summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-[#29323d]">
        {/* Col 1: Title & Severity */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold tracking-wide text-slate-400">
              {isMemoryGrowthObservation ? "Current observation" : "Current diagnosis"}
            </span>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
              isMemoryGrowthObservation
                ? "bg-sky-500/10 text-sky-300 border-sky-500/25"
                : isHigh ? "bg-rose-500/15 text-rose-400 border-rose-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"
            }`}>
              {isMemoryGrowthObservation ? "OBSERVATION" : `${activeEvent.severity} SEVERITY`}
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-100 tracking-tight">
            {activeEvent.probable_cause}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Duration: {formatDuration(activeEvent.start_time, activeEvent.end_time)}</span>
          </div>
        </div>

        {/* Col 2: Primary contributor */}
        <div className="bg-[#11171f] border border-[#232d38] rounded-lg p-4 flex flex-col justify-center">
          <span className="text-xs text-slate-400 font-sans">
            {isMemoryGrowthObservation ? "Application observed" : "Primary observed contributor"}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="text-lg font-bold font-mono text-slate-100">
              {activeEvent.primary_display_name || activeEvent.primary_process || "System Aggregate"}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 mt-0.5">
            {isMemoryGrowthObservation
              ? "Associated with this process trend; not evidence of a system fault."
              : "Measured process attribution; association does not prove causation."}
          </span>
        </div>

        {/* Col 3: Evidence Strength */}
        <div className="bg-[#11171f] border border-[#232d38] rounded-lg p-4 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
            <span>{isMemoryGrowthObservation ? "Evidence score" : "Evidence strength"}</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {strength === null ? "Not scored" : `${strength}%`}
            </span>
          </div>
          {strength !== null && (
            <div className="w-full h-2 rounded-full bg-slate-800 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${strength}%` }}
              />
            </div>
          )}
          <span className="text-[11px] font-mono text-slate-500 mt-1.5">
            {isMemoryGrowthObservation
              ? "Memory trends are not assigned a corroboration score."
              : "Score is available only when supporting evidence was calculated."}
          </span>
        </div>
      </div>

      {/* Evidence checklist */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
            {isMemoryGrowthObservation ? "Recorded observation details" : "Recorded evidence"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-[#11171f] border border-[#232d38] text-xs font-mono text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="pt-2 flex items-center justify-between">
        <span className="text-xs font-mono text-slate-500">
          Detected at {formatDateTime(activeEvent.start_time)}
        </span>

        <Link
          href={`/events/${activeEvent.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 text-xs font-mono transition-colors shadow-sm"
        >
          View evidence <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
