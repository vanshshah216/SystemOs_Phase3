"use client";
import Link from "next/link";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { DiagnosisEvent } from "@/types";
import { ChevronRight, ArrowRight } from "lucide-react";

interface RecentEventsSectionProps {
  events: DiagnosisEvent[];
  loading?: boolean;
}

export default function RecentEventsSection({ events, loading }: RecentEventsSectionProps) {
  const displayEvents = events.slice(0, 5);

  return (
    <div className="liquid-glass-card p-6 sm:p-7 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDF0F5]">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#2563EB]">
            Audit Trail
          </span>
          <h3 className="text-lg font-bold text-[#172033] font-sans mt-0.5">
            Recent Incidents & Observations
          </h3>
          <p className="text-xs text-[#667085] font-sans mt-0.5">
            Chronological audit log of diagnosed system anomalies and state resolutions.
          </p>
        </div>

        <Link
          href="/events"
          className="text-xs font-mono text-[#2563EB] hover:text-[#1D4ED8] font-semibold inline-flex items-center gap-1 shrink-0 self-start sm:self-center transition-colors"
        >
          View all events <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table / List */}
      {loading && events.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-[#98A2B3]">
          Loading event audit log...
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-[#98A2B3]">
          No diagnostic events recorded yet. System is performing within healthy statistical bounds.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#EDF0F5] text-[#667085]">
                <th className="text-left py-3 px-3 font-bold">Severity</th>
                <th className="text-left py-3 px-3 font-bold">Probable Cause</th>
                <th className="text-left py-3 px-3 font-bold">Primary Process</th>
                <th className="text-left py-3 px-3 font-bold">Duration</th>
                <th className="text-left py-3 px-3 font-bold">Timestamp</th>
                <th className="text-left py-3 px-3 font-bold">Status</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF0F5]">
              {displayEvents.map(event => {
                const isHigh = event.severity === "HIGH";
                const isMedium = event.severity === "MEDIUM";
                const isActive = event.status === "active";

                return (
                  <tr
                    key={event.id}
                    className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isHigh
                            ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                            : isMedium
                            ? "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                            : "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]"
                        }`}
                      >
                        {event.severity}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-[#172033] font-bold max-w-xs truncate">
                      <Link href={`/events/${event.id}`} className="hover:text-[#2563EB] transition-colors">
                        {event.probable_cause}
                      </Link>
                    </td>

                    <td className="py-3.5 px-3 text-[#667085] font-semibold">
                      {event.primary_display_name || event.primary_process || "—"}
                    </td>

                    <td className="py-3.5 px-3 text-[#667085]">
                      {formatDuration(event.start_time, event.end_time)}
                    </td>

                    <td className="py-3.5 px-3 text-[#98A2B3] whitespace-nowrap">
                      {formatDateTime(event.start_time)}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isActive
                            ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                            : "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? "bg-[#DC2626] animate-pulse" : "bg-[#16A34A]"
                          }`}
                        />
                        {isActive ? "Active" : "Resolved"}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <Link
                        href={`/events/${event.id}`}
                        className="p-1 rounded-lg text-[#98A2B3] hover:text-[#2563EB] hover:bg-[#EFF6FF] inline-flex transition-colors"
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
