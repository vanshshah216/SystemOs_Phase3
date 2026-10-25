"use client";
import { useState, useMemo } from "react";
import TopBar from "@/components/layout/TopBar";
import { useEvents } from "@/hooks/useEvents";
import { formatDateTime, formatDuration } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

const FILTERS = [
  { id: "all", label: "All Events" },
  { id: "cpu", label: "CPU" },
  { id: "memory", label: "Memory" },
  { id: "disk", label: "Disk" },
  { id: "network", label: "Network" },
  { id: "application", label: "Applications" },
  { id: "browser_tab", label: "Browser tabs" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
];

export default function EventsPage() {
  const { events, loading, error } = useEvents(3500, true, true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Filter by category/status
      if (filter === "active" && e.status !== "active") return false;
      if (filter === "resolved" && e.status !== "resolved") return false;
      if (["cpu", "memory", "disk", "network", "application", "browser_tab"].includes(filter) && e.category !== filter) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCause = e.probable_cause?.toLowerCase().includes(q);
        const matchProc = e.primary_display_name?.toLowerCase().includes(q) || e.primary_process?.toLowerCase().includes(q);
        const matchExe = e.primary_process_name?.toLowerCase().includes(q);
        if (!matchCause && !matchProc && !matchExe) return false;
      }
      return true;
    });
  }, [events, filter, search]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      <TopBar title="Event History" subtitle="Forensic Audit Log" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033] font-sans">
            Event history
          </h2>
          <p className="text-sm text-[#667085] font-sans mt-1">
            Performance incidents, application starts, and optional browser-tab activity. Tab titles are collected locally; URLs and page contents are not.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Filters */}
          <div className="flex items-center gap-1 bg-white/85 border border-slate-200/80 p-1.5 rounded-xl overflow-x-auto shadow-xs backdrop-blur-md">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                  filter === f.id
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by event, app, or tab title..."
              className="bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 outline-none w-full sm:w-72 shadow-xs transition-colors"
            />
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white/90 border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm shadow-slate-200/50 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                  <th className="text-left py-3.5 px-4 font-semibold">Severity</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Probable Cause</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Process Association</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Duration</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Timestamp</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 font-mono">
                      Loading event history...
                    </td>
                  </tr>
                ) : error && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-amber-700 font-mono">
                      Event history is unavailable: {error}
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 font-mono">
                      No events match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(event => {
                    const isHigh = event.severity === "HIGH";
                    const isMedium = event.severity === "MEDIUM";
                    const isActive = event.status === "active";
                    const isApplicationStart = event.event_type === "application_started";
                    const isBrowserTabActivity = event.event_type === "browser_tab_activity";
                    const isActivityEvent = isApplicationStart || isBrowserTabActivity;

                    return (
                      <tr
                        key={event.id}
                        className="h-14 hover:bg-blue-50/30 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isHigh
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : isMedium
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {isBrowserTabActivity ? "TAB" : isApplicationStart ? "APP" : event.severity}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-900 font-semibold max-w-sm truncate">
                          <Link href={`/events/${event.id}`} className="hover:text-blue-600 transition-colors">
                            {event.probable_cause}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {event.primary_display_name || event.primary_process || "Not established"}
                          {event.primary_pid ? <span className="ml-1 text-slate-400">PID {event.primary_pid}</span> : null}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500">
                          {formatDuration(event.start_time, event.end_time)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDateTime(event.start_time)}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isActive
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? "bg-blue-600 animate-pulse" : "bg-emerald-600"
                              }`}
                            />
                            {isActivityEvent ? "Recorded" : isActive ? "Active" : "Resolved"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/events/${event.id}`}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 inline-flex items-center gap-1 text-xs font-semibold group-hover:translate-x-0.5 transition"
                          >
                            Inspect <ChevronRight className="w-3.5 h-3.5" />
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

        <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
          <span>Logged in local SQLite database</span>
          <span>Showing {filteredEvents.length} of {events.length} records</span>
        </div>
      </main>
    </div>
  );
}
