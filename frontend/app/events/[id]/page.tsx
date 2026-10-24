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
  ArrowDown,
} from "lucide-react";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventId = parseInt(id, 10);
  const { event, loading, error } = useEvent(eventId);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
        <TopBar title="Event Details" subtitle="Loading..." />
        <main className="flex-1 p-10 flex items-center justify-center text-xs font-mono text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400 mr-2" /> Retrieving event forensic dossier...
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
        <TopBar title="Event Details" subtitle="Not Found" />
        <main className="flex-1 p-10 text-center text-xs font-mono text-slate-500">
          {error ? `Unable to load event: ${error}` : `Event #${eventId} could not be located in local SQLite database.`}
        </main>
      </div>
    );
  }

  const ev = event.evidence;
  const items = ev?.evidence_items ?? [];
  const raw = ev?.raw_stats ?? {};
  const strength = ev?.evidence_strength;
  const isHigh = event.severity === "HIGH";
  const isMemoryGrowthObservation =
    raw.rule_id === "E" ||
    /memory growth|memory increase observed/i.test(event.probable_cause);
  const isBrowserTabActivity = event.event_type === "browser_tab_activity";
  const zscoreThreshold = typeof raw.zscore_threshold === "number" ? raw.zscore_threshold : null;
  const persistenceRequired = typeof raw.persistence_required === "number" ? raw.persistence_required : null;

  if (isBrowserTabActivity) {
    const title = typeof raw.tab_title === "string" ? raw.tab_title : event.probable_cause;
    const browser = typeof raw.browser === "string" ? raw.browser : event.primary_display_name;
    const action = typeof raw.activity === "string" ? raw.activity.replace(/_/g, " ") : "observed";

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
        <TopBar title="Browser tab activity" subtitle="Local browser title and activity record" />
        <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1000px] w-full mx-auto space-y-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 font-mono transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Event History
          </Link>
          <section className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-5">
            <div>
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
                Browser tab activity
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mt-2 break-words">{title}</h2>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#29323d] pt-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Browser</dt>
                <dd className="text-slate-200 mt-1">{browser}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Activity</dt>
                <dd className="text-slate-200 mt-1 capitalize">{action}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Recorded</dt>
                <dd className="text-slate-200 mt-1">{formatDateTime(event.start_time)}</dd>
              </div>
            </dl>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-slate-300 space-y-2">
              <p>This record comes from the optional SYSTEMOS browser extension. It stores the tab title and activity type only; it does not send the page URL or content.</p>
              <p>CPU and memory are measured for the whole browser by Windows. The browser does not provide reliable per-tab resource figures to this monitor, so this page does not attribute browser resource use to this tab.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
      <TopBar title={`Event #${event.id}`} subtitle="Forensic Analysis" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-400 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Event History
        </Link>

        {/* Header Section */}
        <div className={`bg-[#151b23] border ${
          isMemoryGrowthObservation ? "border-sky-500/30" : isHigh ? "border-rose-500/40" : "border-amber-500/40"
        } rounded-xl p-6 sm:p-7 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isMemoryGrowthObservation ? "text-sky-400" : "text-rose-400"}`}>
                  {isMemoryGrowthObservation ? "Memory trend observation" : "Event details"}
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
                  ? "bg-sky-500/10 text-sky-300 border-sky-500/25"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {event.status === "active" ? "Ongoing" : "Resolved"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#29323d] text-xs font-mono">
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Incident Initiated</div>
              <div className="text-slate-200 font-semibold mt-0.5">{formatDateTime(event.start_time)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Duration</div>
              <div className="text-slate-200 font-semibold mt-0.5">{formatDuration(event.start_time, event.end_time)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">
                {isMemoryGrowthObservation ? "Application observed" : "Process association"}
              </div>
              <div className="text-amber-300 font-bold mt-0.5">
                {event.primary_display_name || event.primary_process || "Not established"}
                {event.primary_pid ? ` · PID ${event.primary_pid}` : ""}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px] uppercase">Telemetry Origin</div>
              <div className="text-sky-400 font-semibold mt-0.5">
                {event.is_demo ? "Synthetic Inject" : "Deterministic psutil"}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: MEASURED INCIDENT DATA */}
        <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="pb-3 border-b border-[#29323d]">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
              Measured telemetry
            </span>
            <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
              Recorded Incident Data
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Values below come from the detector evidence. No synthetic timeline samples are presented for live incidents.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="rounded-lg border border-[#232d38] bg-[#11171f] p-4">
              <div className="text-[10px] uppercase text-slate-500">Detection started</div>
              <div className="mt-1 font-semibold text-slate-200">{formatDateTime(event.start_time)}</div>
            </div>
            <div className="rounded-lg border border-[#232d38] bg-[#11171f] p-4">
              <div className="text-[10px] uppercase text-slate-500">Incident duration</div>
              <div className="mt-1 font-semibold text-slate-200">{formatDuration(event.start_time, event.end_time)}</div>
            </div>
            <div className="rounded-lg border border-[#232d38] bg-[#11171f] p-4">
              <div className="text-[10px] uppercase text-slate-500">Detection category</div>
              <div className="mt-1 font-semibold capitalize text-slate-200">{event.category || "system"}</div>
            </div>
          </div>
          {strength && (
            <p className="text-xs text-slate-400">
              Evidence score: <span className="font-mono text-slate-200">{strength.score}%</span>
            </p>
          )}
        </div>

        {/* SECTION 2: 5-STAGE FLOW DIAGRAM */}
        <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-4">
          <div className="pb-3 border-b border-[#29323d]">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
              Reasoning steps
            </span>
            <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
              Diagnostic Decision Flow
            </h3>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-xs">
            <div className="flex-1 w-full p-4 rounded-lg bg-[#11171f] border border-sky-500/30 text-center">
              <span className="text-[10px] text-sky-400 font-semibold block mb-1">Step 1</span>
              <div className="font-bold text-slate-100">{isMemoryGrowthObservation ? "Memory trend" : "Statistical Anomaly"}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isMemoryGrowthObservation
                  ? `${raw.sample_count ?? "—"} samples`
                  : zscoreThreshold != null ? `Z ≥ ${zscoreThreshold.toFixed(1)}σ` : "Configured threshold"}
              </div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-[#11171f] border border-sky-500/30 text-center">
              <span className="text-[10px] text-sky-400 font-semibold block mb-1">Step 2</span>
              <div className="font-bold text-slate-100">{isMemoryGrowthObservation ? "Observation window" : "Persistence Filter"}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isMemoryGrowthObservation
                  ? typeof raw.observation_seconds === "number" ? `${(raw.observation_seconds / 60).toFixed(0)} minutes` : "Duration unavailable"
                  : persistenceRequired != null ? `N = ${persistenceRequired} consecutive samples` : "Configured consecutive-sample requirement"}
              </div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-[#11171f] border border-amber-500/30 text-center">
              <span className="text-[10px] text-amber-400 font-semibold block mb-1">Step 3</span>
              <div className="font-bold text-slate-100">{isMemoryGrowthObservation ? "Interpretation" : "Cross-Resource Corroboration"}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isMemoryGrowthObservation ? "Trend alone does not prove a fault" : "Only measured supporting signals"}
              </div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-[#11171f] border border-sky-500/30 text-center">
              <span className="text-[10px] text-sky-400 font-semibold block mb-1">Step 4</span>
              <div className="font-bold text-slate-100">{isMemoryGrowthObservation ? "Observed process" : "Process Association"}</div>
              <div className="text-[11px] text-slate-400 mt-1">{event.primary_display_name || event.primary_process || "Process cause not established"}</div>
            </div>

            <ArrowDown className="w-4 h-4 text-slate-600 md:-rotate-90 shrink-0" />

            <div className="flex-1 w-full p-4 rounded-lg bg-rose-500/10 border border-rose-500/40 text-center">
              <span className="text-[10px] text-rose-400 font-semibold block mb-1">Step 5</span>
              <div className="font-bold text-rose-300">{isMemoryGrowthObservation ? "Observation recorded" : "Diagnosis Emitted"}</div>
              <div className="text-[11px] text-rose-400/80 mt-1">
                {strength?.score != null ? `${strength.score}% Strength` : "Evidence score unavailable"}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: EXPLAINABILITY CHAIN */}
        {items.length > 0 && (
          <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Corroborating Evidence Chain
            </h3>
            <div className="space-y-2">
              {items.map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-[#11171f] border border-[#232d38] text-xs font-mono text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: RAW STATISTICAL VALUES */}
        {Object.keys(raw).length > 0 && (
          <div className="bg-[#151b23] border border-[#29323d] rounded-xl p-6 sm:p-7 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Engine Statistical Variables
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 font-mono text-xs">
              {Object.entries(raw).map(([k, v]) => {
                const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                let valStr = "—";
                if (typeof v === "number") {
                  valStr = k.includes("bytes")
                    ? `${formatBytes(v)}${["current_bytes", "baseline_bytes"].includes(k) ? "" : "/s"}`
                    : v.toFixed(2);
                } else if (v != null) {
                  valStr = String(v);
                }
                return (
                  <div key={k} className="p-3 rounded-lg bg-[#11171f] border border-[#232d38]">
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
