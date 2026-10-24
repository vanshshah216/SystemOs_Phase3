"use client";
import { Shield, ChevronRight, CheckCircle2, Clock, Cpu, AlertOctagon } from "lucide-react";
import Link from "next/link";
import type { DiagnosisEvent } from "@/types";
import { formatDateTime, formatDuration, severityColor } from "@/lib/utils";

interface DiagnosisCardProps {
  event: DiagnosisEvent;
  compact?: boolean;
}

export default function DiagnosisCard({ event, compact = false }: DiagnosisCardProps) {
  const evidence   = event.evidence;
  const strength   = evidence?.evidence_strength?.score;
  const items      = evidence?.evidence_items ?? [];
  const rawStats   = evidence?.raw_stats ?? {};

  const isHigh = event.severity === "HIGH";
  const isActive = event.status === "active";
  const isMemoryGrowthObservation =
    rawStats.rule_id === "E" ||
    /memory growth|memory increase observed/i.test(event.probable_cause);
  const emphasizeActive = isActive && !isMemoryGrowthObservation;

  return (
    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 backdrop-blur-xl p-6 ${
      emphasizeActive
        ? "border-rose-500/40 bg-gradient-to-br from-rose-950/20 via-[#0d1222]/90 to-[#070b14]/95 shadow-xl shadow-rose-950/30" 
        : "border-white/[0.08] bg-gradient-to-br from-white/[0.03] via-[#0d1222]/90 to-[#070b14]/95"
    }`}>
      {/* Top glowing line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        emphasizeActive ? "bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse" : "bg-white/[0.1]"
      }`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
            isMemoryGrowthObservation
              ? "bg-sky-500/10 border-sky-500/25 text-sky-400"
              : isHigh ? "bg-rose-500/15 border-rose-500/40 text-rose-400" : "bg-amber-500/15 border-amber-500/40 text-amber-400"
          }`}>
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${severityColor(event.severity)}`}>
                {event.is_demo ? "DEMO SYNTHETIC — " : "REAL TELEMETRY — "}
                {isMemoryGrowthObservation ? "MEMORY TREND OBSERVATION" : "SYSTEM BOTTLENECK"}
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                isHigh ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}>
                {event.severity} SEVERITY
              </span>
            </div>
            <h3 className="text-lg font-bold text-white font-mono mt-0.5">
              {event.probable_cause}
            </h3>
          </div>
        </div>

        <span className={`text-[10px] px-2.5 py-1 rounded-full font-mono font-extrabold flex items-center gap-1.5 ${
          isActive
            ? "bg-sky-500/10 text-sky-300 border border-sky-500/25"
            : "bg-white/[0.05] text-gray-400 border border-white/[0.08]"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-sky-400" : "bg-gray-500"}`} />
          {isActive ? (isMemoryGrowthObservation ? "Monitoring" : "Ongoing") : "Resolved"}
        </span>
      </div>

      {/* Metric telemetry deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 font-mono">
        <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3">
          <div className="text-[10px] text-gray-500 uppercase">
            {isMemoryGrowthObservation ? "Application observed" : "Primary Process"}
          </div>
          <div className="text-sm font-bold text-amber-300 truncate mt-1 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate">{event.primary_display_name || event.primary_process || "—"}</span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3">
          <div className="text-[10px] text-gray-500 uppercase">Duration</div>
          <div className="text-sm font-bold text-gray-200 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span>{formatDuration(event.start_time, event.end_time)}</span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3">
          <div className="text-[10px] text-gray-500 uppercase">Telemetry Engine</div>
          <div className="text-sm font-bold text-gray-300 mt-1 truncate">
            {event.is_demo ? "Synthetic Inject" : "Psutil Kernel"}
          </div>
        </div>

        {strength != null && (
          <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase">Corroboration</div>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{strength}% Score</span>
            </div>
          </div>
        )}
      </div>

      {/* Evidence chain */}
      {!compact && items.length > 0 && (
        <div className="mb-4 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Evidence Attribution Chain
          </div>
          <div className="space-y-2">
            {items.map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-gray-300 font-mono bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corroboration progress bar */}
      {strength != null && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1.5">
            <span>Statistical Corroboration Score</span>
            <span className="text-emerald-400 font-bold">{strength}% Multi-Signal</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 transition-all duration-700 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 pt-3 border-t border-white/[0.06]">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-400" />
          Detected: {formatDateTime(event.start_time)}
        </span>
        <Link
          href={`/events/${event.id}`}
          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold transition-colors group"
        >
          View Full Evidence Matrix <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
