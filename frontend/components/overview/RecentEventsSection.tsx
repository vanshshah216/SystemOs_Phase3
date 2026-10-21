"use client";
import Link from "next/link";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { DiagnosisEvent } from "@/types";
import { ChevronRight, History, ArrowRight } from "lucide-react";

interface RecentEventsSectionProps {
  events: DiagnosisEvent[];
  loading?: boolean;
}

export default function RecentEventsSection({ events, loading }: RecentEventsSectionProps) {
  const displayEvents = events.slice(0, 5);

  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1e293b]">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            AUDIT TRAIL
          </span>
          <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
            Recent Events
          </h3>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Chronological record of diagnosed performance anomalies and state resolutions.
          </p>
        </div>

        <Link
          href="/events"
          className="text-xs font-mono text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 shrink-0 self-start sm:self-center"
        >
          View all events <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table / List */}
      {loading && events.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-slate-500">
          Loading event audit log...
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-slate-500">
          No diagnostic events recorded yet. System is performing within healthy statistical bounds.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e293b] text-slate-400">
                <th className="text-left py-3 px-3 font-semibold">Severity</th>
                <th className="text-left py-3 px-3 font-semibold">Probable Cause</th>
                <th className="text-left py-3 px-3 font-semibold">Primary Process</th>
                <th className="text-left py-3 px-3 font-semibold">Duration</th>
                <th className="text-left py-3 px-3 font-semibold">Timestamp</th>
                <th className="text-left py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/60">
              {displayEvents.map(event => {
                const isHigh = event.severity === "HIGH";
                const isMedium = event.severity === "MEDIUM";
                const isActive = event.status === "active";

                return (
                  <tr
                    key={event.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isHigh
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : isMedium
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                        }`}
                      >
                        {event.severity}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-slate-200 font-semibold max-w-xs truncate">
                      <Link href={`/events/${event.id}`} className="hover:text-sky-400">
                        {event.probable_cause}
                      </Link>
                    </td>

                    <td className="py-3.5 px-3 text-slate-300 font-medium">
                      {event.primary_process || "—"}
                    </td>

                    <td className="py-3.5 px-3 text-slate-400">
                      {formatDuration(event.start_time, event.end_time)}
                    </td>

                    <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                      {formatDateTime(event.start_time)}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isActive
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? "bg-rose-400 animate-pulse" : "bg-emerald-400"
                          }`}
                        />
                        {isActive ? "Active" : "Resolved"}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <Link
                        href={`/events/${event.id}`}
                        className="p-1 rounded text-slate-500 hover:text-sky-400 inline-flex"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
