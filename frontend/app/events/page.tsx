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
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
      <TopBar title="Event History" subtitle="Forensic Audit Log" />

      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 font-sans">
            Event history
          </h2>
          <p className="text-sm text-slate-400 font-sans mt-1">
            Performance incidents, application starts, and optional browser-tab activity. Tab titles are collected locally; URLs and page contents are not.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Filters */}
          <div className="flex items-center gap-1 bg-[#151b23] border border-[#29323d] p-1.5 rounded-lg overflow-x-auto">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors shrink-0 ${
                  filter === f.id
                    ? "bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by event, app, or tab title..."
              className="bg-[#151b23] border border-[#29323d] focus:border-sky-500/50 rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none w-full sm:w-64 transition-colors"
            />
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-[#151b23] border border-[#29323d] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#29323d] bg-[#11171f] text-slate-400">
                  <th className="text-left py-3.5 px-4 font-semibold">Severity</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Probable Cause</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Process Association</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Duration</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Timestamp</th>
                  <th className="text-left py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#29323d]/60">
                {loading && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500 font-mono">
                      Loading event history...
                    </td>
                  </tr>
                ) : error && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-amber-300 font-mono">
                      Event history is unavailable: {error}
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500 font-mono">
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
                        className="h-14 hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isHigh
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : isMedium
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            }`}
                          >
                            {isBrowserTabActivity ? "TAB" : isApplicationStart ? "APP" : event.severity}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-200 font-semibold max-w-sm truncate">
                          {isActivityEvent ? (
                            <Link href={`/events/${event.id}`} className="hover:text-sky-400">
                              {event.probable_cause}
                            </Link>
                          ) : (
                            <Link href={`/events/${event.id}`} className="hover:text-sky-400">
                              {event.probable_cause}
                            </Link>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {event.primary_display_name || event.primary_process || "Not established"}
                          {event.primary_pid ? <span className="ml-1 text-slate-500">PID {event.primary_pid}</span> : null}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400">
                          {formatDuration(event.start_time, event.end_time)}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDateTime(event.start_time)}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isActive
                                ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? "bg-sky-400" : "bg-emerald-400"
                              }`}
                            />
                            {isActivityEvent ? "Recorded" : isActive ? "Active" : "Resolved"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isActivityEvent ? (
                            <Link
                              href={`/events/${event.id}`}
                              className="p-1 rounded text-slate-500 hover:text-sky-400 inline-flex items-center gap-1 text-xs"
                            >
                              Inspect <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          ) : (
                            <Link
                              href={`/events/${event.id}`}
                              className="p-1 rounded text-slate-500 hover:text-sky-400 inline-flex items-center gap-1 text-xs"
                            >
                              Inspect <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          )}
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
