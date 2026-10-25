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
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 backdrop-blur-xl p-6 hover:shadow-lg ${
        emphasizeActive
          ? "border-rose-200 bg-white/95 shadow-lg shadow-rose-500/5 hover:border-rose-300"
          : "border-slate-200/80 bg-white/85 shadow-sm shadow-slate-200/50 hover:border-blue-200 hover:shadow-md"
      }`}
    >
      {/* Top accent accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] ${
          emphasizeActive
            ? "bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse"
            : "bg-gradient-to-r from-blue-400/30 via-slate-200 to-blue-400/30"
        }`}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs ${
              isMemoryGrowthObservation
                ? "bg-sky-50 border-sky-200 text-sky-600"
                : isHigh
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : "bg-amber-50 border-amber-200 text-amber-600"
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isHigh ? "text-rose-600" : "text-amber-700"
                }`}
              >
                {event.is_demo ? "DEMO SYNTHETIC — " : "REAL TELEMETRY — "}
                {isMemoryGrowthObservation ? "MEMORY TREND OBSERVATION" : "SYSTEM BOTTLENECK"}
              </span>
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                  isHigh
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {event.severity} SEVERITY
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#172033] font-mono mt-0.5">
              {event.probable_cause}
            </h3>
          </div>
        </div>

        <span
          className={`text-[11px] px-3 py-1 rounded-full font-mono font-bold flex items-center gap-1.5 shrink-0 border ${
            isActive
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-blue-600 animate-pulse" : "bg-emerald-600"}`}
          />
          {isActive ? (isMemoryGrowthObservation ? "Monitoring" : "Ongoing") : "Resolved"}
        </span>
      </div>

      {/* Metric telemetry deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 font-mono">
        <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {isMemoryGrowthObservation ? "Application observed" : "Primary Process"}
          </div>
          <div className="text-sm font-bold text-slate-900 truncate mt-1 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{event.primary_display_name || event.primary_process || "—"}</span>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Duration</div>
          <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{formatDuration(event.start_time, event.end_time)}</span>
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Telemetry Engine</div>
          <div className="text-sm font-bold text-slate-800 mt-1 truncate">
            {event.is_demo ? "Synthetic Inject" : "Psutil Kernel"}
          </div>
        </div>

        {strength != null && (
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 shadow-xs">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Corroboration</div>
            <div className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>{strength}% Score</span>
            </div>
          </div>
        )}
      </div>

      {/* Evidence chain */}
      {!compact && items.length > 0 && (
        <div className="mb-4 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-mono text-slate-600 font-bold uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Evidence Attribution Chain
          </div>
          <div className="space-y-2">
            {items.map((item: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2.5 text-xs text-slate-700 font-mono bg-slate-50/70 border border-slate-200/60 p-2.5 rounded-lg"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corroboration progress bar */}
      {strength != null && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1.5">
            <span>Statistical Corroboration Score</span>
            <span className="text-emerald-600 font-bold">{strength}% Multi-Signal</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 transition-all duration-700"
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-3 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-400" />
          Detected: {formatDateTime(event.start_time)}
        </span>
        <Link
          href={`/events/${event.id}`}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold transition-colors group"
        >
          View Full Evidence Matrix{" "}
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
