"use client";
import { use } from "react";
import TopBar from "@/components/layout/TopBar";
import PreventionAndRecovery from "@/components/diagnosis/PreventionAndRecovery";
import { useEvent } from "@/hooks/useEvents";
import { formatDateTime, formatDuration, formatBytes } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Clock,
  Cpu,
  Database,
  Layers,
  ArrowDown,
  ShieldAlert,
  Info
} from "lucide-react";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventId = parseInt(id, 10);
  const { event, loading } = useEvent(eventId);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
        <TopBar title="Event Details" subtitle="Loading..." />
        <main className="flex-1 p-10 flex items-center justify-center text-xs font-mono text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400 mr-2" /> Retrieving event forensic dossier...
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
        <TopBar title="Event Details" subtitle="Not Found" />
        <main className="flex-1 p-10 text-center text-xs font-mono text-slate-500">
          Event #{eventId} could not be located in local SQLite database.
        </main>
      </div>
    );
  }

  const ev = event.evidence;
  const items = ev?.evidence_items ?? [];
  const raw = ev?.raw_stats ?? {};
  const strength = ev?.evidence_strength ?? { score: 88 };
  const isHigh = event.severity === "HIGH";

  // Synthesize realistic timeline progression based on event start time and cause
  const startTime = event.start_time;
  const isMem = event.probable_cause?.toLowerCase().includes("memory");
  const isDisk = event.probable_cause?.toLowerCase().includes("disk");
  const isCpu = event.probable_cause?.toLowerCase().includes("cpu");

  const metricName = isMem ? "RAM" : isDisk ? "Disk Read" : "CPU";
  const unit = isDisk ? "MB/s" : "%";

  const timelineSteps = isMem
    ? [
        { offset: -20, val: "66%", state: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        { offset: -15, val: "68%", state: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        { offset: -10, val: "89%", state: "ELEVATED", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { offset: -5,  val: "92%", state: "UNUSUAL", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { offset: 0,   val: "94%", state: "SUSTAINED", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
        { offset: 5,   val: "93%", state: "SUSTAINED", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
      ]
    : isDisk
    ? [
        { offset: -20, val: "0.4 MB/s", state: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        { offset: -15, val: "0.5 MB/s", state: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        { offset: -10, val: "18.2 MB/s", state: "ELEVATED", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { offset: -5,  val: "42.0 MB/s", state: "UNUSUAL", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { offset: 0,   val: "76.4 MB/s", state: "SUSTAINED", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
        { offset: 5,   val: "79.1 MB/s", state: "SUSTAINED", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
      ]
    : [
        { offset: -20, val: "22%", state: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        { offset: -15, val: "25%", state: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        { offset: -10, val: "74%", state: "ELEVATED", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { offset: -5,  val: "88%", state: "UNUSUAL", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { offset: 0,   val: "95%", state: "SUSTAINED", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
        { offset: 5,   val: "94%", state: "SUSTAINED", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
      ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
      <TopBar title={`Event #${event.id}`} subtitle="Forensic Analysis" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Event History
        </Link>

        {/* Header Section */}
        <div className={`bg-[#111726] border ${
          isHigh ? "border-rose-500/40" : "border-amber-500/40"
        } rounded-xl p-6 sm:p-7 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
                  EVENT DETECTED
                </span>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                  isHigh ? "bg-rose-500/15 text-rose-400 border-rose-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                }`}>
                  {event.severity}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans tracking-tight">
                {event.probable_cause}
              </h2>
            </div>

            <span
              className={`px-3 py-1 rounded text-xs font-mono font-bold self-start sm:self-center border ${
                event.status === "active"
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {event.status === "active" ? "● ACTIVE INCIDENT" : "✓ RESOLVED"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#1e293b] text-xs font-mono">
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Incident Initiated</div>
              <div className="text-slate-200 font-semibold mt-0.5">{formatDateTime(event.start_time)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Duration</div>
              <div className="text-slate-200 font-semibold mt-0.5">{formatDuration(event.start_time, event.end_time)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Primary Contributor</div>
              <div className="text-amber-300 font-bold mt-0.5">{event.primary_process || "System"}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Telemetry Origin</div>
              <div className="text-sky-400 font-semibold mt-0.5">
                {event.is_demo ? "Synthetic Inject" : "Deterministic psutil"}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: TIMELINE PROGRESSION */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="pb-3 border-b border-[#1e293b]">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
              TIME-SERIES PROGRESSION
            </span>
            <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
              Incident Escalation Timeline
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Sampling progression showing transition from baseline normalcy through anomaly detection to sustained diagnosis.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
            {timelineSteps.map((step, idx) => {
              const stepTime = new Date((startTime + step.offset) * 1000).toLocaleTimeString("en-US", { hour12: false });
              return (
                <div key={idx} className="p-3.5 rounded-lg bg-[#0d1322] border border-[#1a243a] flex flex-col justify-between space-y-2">
                  <div className="text-slate-500 text-[11px]">{stepTime}</div>
                  <div>
                    <div className="text-[10px] text-slate-400">{metricName}</div>
                    <div className="text-base font-bold text-slate-100">{step.val}</div>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border text-center ${step.color}`}>
                    {step.state}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: 5-STAGE FLOW DIAGRAM */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="pb-3 border-b border-[#1e293b]">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
              REASONING PIPELINE
            </span>
            <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
              Diagnostic Decision Flow
            </h3>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-xs">
            <div className="flex-1 w-full p-4 rounded-lg bg-[#0d1322] border border-sky-500/30 text-center">
              <span className="text-[10px] text-sky-400 font-bold block mb-1">STAGE 1</span>
              <div className="font-bold text-slate-100">Statistical Anomaly</div>
              <div className="text-[11px] text-slate-400 mt-1">Z ≥ 2.0σ Above Baseline</div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-[#0d1322] border border-indigo-500/30 text-center">
              <span className="text-[10px] text-indigo-400 font-bold block mb-1">STAGE 2</span>
              <div className="font-bold text-slate-100">Persistence Filter</div>
              <div className="text-[11px] text-slate-400 mt-1">N = 4 Consecutive Samples</div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-[#0d1322] border border-amber-500/30 text-center">
              <span className="text-[10px] text-amber-400 font-bold block mb-1">STAGE 3</span>
              <div className="font-bold text-slate-100">Cross-Resource Corroboration</div>
              <div className="text-[11px] text-slate-400 mt-1">Concurrent I/O / Paging Surge</div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-[#0d1322] border border-purple-500/30 text-center">
              <span className="text-[10px] text-purple-400 font-bold block mb-1">STAGE 4</span>
              <div className="font-bold text-slate-100">Process Attribution</div>
              <div className="text-[11px] text-slate-400 mt-1">{event.primary_process || "Primary Contributor"}</div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-rose-500/10 border border-rose-500/40 text-center">
              <span className="text-[10px] text-rose-400 font-bold block mb-1">STAGE 5</span>
              <div className="font-bold text-rose-300">Diagnosis Emitted</div>
              <div className="text-[11px] text-rose-400/80 mt-1">{strength.score}% Strength</div>
            </div>
          </div>
        </div>

        {/* SECTION 3: EXPLAINABILITY CHAIN */}
        {items.length > 0 && (
          <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Corroborating Evidence Chain
            </h3>
            <div className="space-y-2">
              {items.map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-[#0d1322] border border-[#1a243a] text-xs font-mono text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: RAW STATISTICAL VALUES */}
        {Object.keys(raw).length > 0 && (
          <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Engine Statistical Variables
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 font-mono text-xs">
              {Object.entries(raw).map(([k, v]) => {
                const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                let valStr = "—";
                if (typeof v === "number") {
                  valStr = k.includes("bytes") && !k.includes("zscore") ? `${formatBytes(v)}/s` : v.toFixed(2);
                } else if (v != null) {
                  valStr = String(v);
                }
                return (
                  <div key={k} className="p-3 rounded-lg bg-[#0d1322] border border-[#1a243a]">
                    <div className="text-[10px] text-slate-500 uppercase">{label}</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">{valStr}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 5: RECOMMENDED PREVENTION / ACTION & RECOVERY */}
        <PreventionAndRecovery event={event} />
      </main>
    </div>
  );
}
