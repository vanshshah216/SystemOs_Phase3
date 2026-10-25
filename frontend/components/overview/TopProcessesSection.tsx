"use client";
import { useState } from "react";
import Link from "next/link";
import { useProcesses } from "@/hooks/useProcesses";
import { formatPct, formatBytes } from "@/lib/utils";
import { Cpu, MemoryStick, HardDrive, ArrowRight } from "lucide-react";

const TABS = [
  { id: "cpu_percent", label: "Top CPU", icon: Cpu },
  { id: "memory_bytes", label: "Top Memory", icon: MemoryStick },
  { id: "io", label: "Top Disk I/O", icon: HardDrive },
];

export default function TopProcessesSection() {
  const [activeTab, setActiveTab] = useState("cpu_percent");
  const { processes, loading } = useProcesses(activeTab, 3500);

  const displayProcs = processes.slice(0, 8);

  return (
    <div className="liquid-glass-card p-6 sm:p-7 space-y-4 shadow-xs">
      {/* Header with Title and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#EDF0F5]">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#2563EB]">
            System Attribution
          </span>
          <h3 className="text-lg font-bold text-[#172033] font-sans mt-0.5">
            Top Consuming Processes
          </h3>
          <p className="text-xs text-[#667085] font-sans mt-0.5">
            Real-time process telemetry attributing resource consumption across logical cores and memory.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#F1F4F8] p-1 rounded-xl border border-[#E5EAF1]">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 ${
                    active
                      ? "bg-white text-[#2563EB] font-bold shadow-xs border border-[#BFDBFE]"
                      : "text-[#667085] hover:text-[#172033]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <Link
            href="/processes"
            className="text-xs font-mono text-[#2563EB] hover:text-[#1D4ED8] font-semibold inline-flex items-center gap-1 transition-colors"
          >
            All processes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Process Table with clear typography and hover transitions */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#EDF0F5] text-[#667085]">
              <th className="text-left py-3 px-4 font-bold">Process</th>
              <th className="text-right py-3 px-4 font-bold">PID</th>
              <th className="text-left py-3 px-6 font-bold w-48">CPU</th>
              <th className="text-left py-3 px-6 font-bold w-44">Memory</th>
              <th className="text-right py-3 px-4 font-bold">Threads</th>
              <th className="text-right py-3 px-4 font-bold">Disk I/O</th>
              <th className="text-right py-3 px-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDF0F5]">
            {loading && processes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#98A2B3] font-mono">
                  Collecting active process snapshots...
                </td>
              </tr>
            ) : displayProcs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#98A2B3] font-mono">
                  No active process metrics available.
                </td>
              </tr>
            ) : (
              displayProcs.map((p, i) => {
                const cpu = p.cpu_percent ?? 0;
                const mem = p.memory_percent ?? 0;
                const isHighCpu = cpu > 40;
                const isElevatedCpu = cpu > 15;

                return (
                  <tr
                    key={`${p.pid}-${i}`}
                    className="h-14 hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  >
                    {/* Process Name */}
                    <td className="py-3 px-4 text-[#172033] font-bold max-w-xs truncate">
                      <Link
                        href={`/processes/${p.pid}`}
                        className="hover:text-[#2563EB] flex items-center gap-2 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{p.display_name || p.name}</span>
                          {p.display_name && p.display_name !== p.name && (
                            <span className="truncate text-[10px] font-normal text-[#98A2B3]">{p.name}</span>
                          )}
                        </span>
                      </Link>
                    </td>

                    {/* PID */}
                    <td className="py-3 px-4 text-[#667085] text-right font-medium">{p.pid}</td>

                    {/* CPU Utilization Bar + Value */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-[#E5EAF1] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isHighCpu ? "bg-[#DC2626]" : isElevatedCpu ? "bg-[#D97706]" : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${Math.min(cpu, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`w-12 text-right font-bold ${
                            isHighCpu
                              ? "text-[#DC2626]"
                              : isElevatedCpu
                              ? "text-[#D97706]"
                              : "text-[#172033]"
                          }`}
                        >
                          {formatPct(p.cpu_percent)}
                        </span>
                      </div>
                    </td>

                    {/* Memory Bar + Value */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-[#E5EAF1] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#7C3AED] transition-all duration-300"
                            style={{ width: `${Math.min(mem, 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-[#172033] font-bold">
                          {formatPct(p.memory_percent)}
                        </span>
                      </div>
                    </td>

                    {/* Threads */}
                    <td className="py-3 px-4 text-[#667085] text-right">{p.threads ?? "—"}</td>

                    {/* Disk I/O */}
                    <td className="py-3 px-4 text-[#667085] text-right">
                      {p.io_read_bytes != null ? `${formatBytes(p.io_read_bytes)}/s` : "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isHighCpu
                            ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                            : isElevatedCpu
                            ? "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                            : "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]"
                        }`}
                      >
                        {isHighCpu ? "Heavy Load" : isElevatedCpu ? "Elevated" : "Normal"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
