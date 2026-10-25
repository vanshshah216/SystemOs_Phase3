"use client";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, ArrowRight, Cpu, Clock, AlertTriangle } from "lucide-react";
import type { DiagnosisEvent } from "@/types";
import { formatDateTime, formatDuration } from "@/lib/utils";

interface CurrentDiagnosisSectionProps {
  activeEvent: DiagnosisEvent | null | undefined;
  loading?: boolean;
}

export default function CurrentDiagnosisSection({ activeEvent, loading }: CurrentDiagnosisSectionProps) {
  if (loading && !activeEvent) {
    return (
      <div className="liquid-glass-card p-7 flex items-center justify-center text-[#667085] font-mono text-xs shadow-xs">
        Evaluating live statistical pipeline...
      </div>
    );
  }

  // When no active bottleneck event
  if (!activeEvent) {
    return (
      <div className="liquid-glass-card p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs bg-white/90">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] shrink-0 shadow-2xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16A34A] font-mono">
                System Status
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                Normal Baseline
              </span>
            </div>
            <h3 className="text-base font-bold text-[#172033] mt-1">
              No sustained abnormal behaviour detected.
            </h3>
            <p className="text-xs text-[#667085] mt-1 max-w-2xl leading-relaxed">
              All monitored system resources are currently operating within expected dynamic baseline bounds. Telemetry is being continuously recorded to local SQLite storage.
            </p>
          </div>
        </div>

        <Link
          href="/diagnostics"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-xs font-semibold font-mono border border-[#BFDBFE] transition-all duration-200 shadow-xs shrink-0 self-start sm:self-center"
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
    <div className={`liquid-glass-card p-7 space-y-6 shadow-sm border ${
      isMemoryGrowthObservation ? "border-[#BFDBFE] bg-white/95" : isHigh ? "border-[#FECACA] bg-[#FEF2F2]/30" : "border-[#FDE68A] bg-[#FFFBEB]/30"
    }`}>
      {/* Top row: 3-column diagnostic summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-[#EDF0F5]">
        {/* Col 1: Title & Severity */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085] font-mono">
              {isMemoryGrowthObservation ? "Current observation" : "Current diagnosis"}
            </span>
            <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              isMemoryGrowthObservation
                ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]"
                : isHigh ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]" : "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
            }`}>
              {isMemoryGrowthObservation ? "OBSERVATION" : `${activeEvent.severity} SEVERITY`}
            </span>
          </div>
          <h3 className="text-xl font-bold text-[#172033] tracking-tight">
            {activeEvent.probable_cause}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#667085]">
            <Clock className="w-3.5 h-3.5 text-[#98A2B3]" />
            <span>Duration: {formatDuration(activeEvent.start_time, activeEvent.end_time)}</span>
          </div>
        </div>

        {/* Col 2: Primary contributor */}
        <div className="glass-well p-4 flex flex-col justify-center">
          <span className="text-xs text-[#667085] font-sans font-medium">
            {isMemoryGrowthObservation ? "Application observed" : "Primary observed contributor"}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Cpu className="w-4 h-4 text-[#2563EB]" />
            <span className="text-base font-bold font-mono text-[#172033]">
              {activeEvent.primary_display_name || activeEvent.primary_process || "System Aggregate"}
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#98A2B3] mt-1 leading-normal">
            {isMemoryGrowthObservation
              ? "Associated with process trend; not proof of fault."
              : "Measured process attribution; correlation does not equal causation."}
          </span>
        </div>

        {/* Col 3: Evidence Strength */}
        <div className="glass-well p-4 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-[#667085] font-sans font-medium">
            <span>{isMemoryGrowthObservation ? "Evidence score" : "Evidence strength"}</span>
            <span className="font-mono font-bold text-[#16A34A] text-sm">
              {strength === null ? "Not scored" : `${strength}%`}
            </span>
          </div>
          {strength !== null && (
            <div className="w-full h-2 rounded-full bg-[#E5EAF1] mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#16A34A] transition-all duration-500"
                style={{ width: `${strength}%` }}
              />
            </div>
          )}
          <span className="text-[11px] font-mono text-[#98A2B3] mt-1.5 leading-normal">
            {isMemoryGrowthObservation
              ? "Memory trends are presented as neutral observations."
              : "Score evaluated across A, P, C, R, T weighted criteria."}
          </span>
        </div>
      </div>

      {/* Evidence checklist */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#667085] font-mono">
            {isMemoryGrowthObservation ? "Recorded observation details" : "Recorded evidence"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#E5EAF1] text-xs font-mono text-[#172033] shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="pt-2 flex items-center justify-between">
        <span className="text-xs font-mono text-[#98A2B3]">
          Detected at {formatDateTime(activeEvent.start_time)}
        </span>

        <Link
          href={`/events/${activeEvent.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs font-mono transition-all duration-200 shadow-sm shadow-blue-500/20 active:scale-[0.98]"
        >
          View Evidence Dossier <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
