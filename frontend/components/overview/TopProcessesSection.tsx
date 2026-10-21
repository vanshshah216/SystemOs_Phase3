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
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 sm:p-7 space-y-4">
      {/* Header with Title and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1e293b]">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            SYSTEM ATTRIBUTION
          </span>
          <h3 className="text-lg font-bold text-slate-100 font-sans mt-0.5">
            Top Processes
          </h3>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Real-time process telemetry attributing resource consumption across logical cores.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#090e18] p-1 rounded-lg border border-[#1e293b]">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-colors ${
                    active
                      ? "bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <Link
            href="/processes"
            className="text-xs font-mono text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1"
          >
            All processes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Process Table with 52-60px row heights and comfortable alignment */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e293b] text-slate-400">
              <th className="text-left py-3 px-4 font-semibold">Process</th>
              <th className="text-right py-3 px-4 font-semibold">PID</th>
              <th className="text-left py-3 px-6 font-semibold w-48">CPU</th>
              <th className="text-left py-3 px-6 font-semibold w-44">Memory</th>
              <th className="text-right py-3 px-4 font-semibold">Threads</th>
              <th className="text-right py-3 px-4 font-semibold">Disk I/O</th>
              <th className="text-right py-3 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/60">
            {loading && processes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                  Collecting active process snapshots...
                </td>
              </tr>
            ) : displayProcs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
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
                    className="h-14 hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  >
                    {/* Process Name */}
                    <td className="py-3 px-4 text-slate-200 font-semibold max-w-xs truncate">
                      <Link
                        href={`/processes/${p.pid}`}
                        className="hover:text-sky-400 flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80" />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    </td>

                    {/* PID */}
                    <td className="py-3 px-4 text-slate-400 text-right">{p.pid}</td>

                    {/* CPU Utilization Bar + Value */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isHighCpu ? "bg-rose-500" : isElevatedCpu ? "bg-amber-400" : "bg-sky-400"
                            }`}
                            style={{ width: `${Math.min(cpu, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`w-12 text-right font-bold ${
                            isHighCpu
                              ? "text-rose-400"
                              : isElevatedCpu
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                        >
                          {formatPct(p.cpu_percent)}
                        </span>
                      </div>
                    </td>

                    {/* Memory Bar + Value */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-400"
                            style={{ width: `${Math.min(mem, 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-slate-300 font-semibold">
                          {formatPct(p.memory_percent)}
                        </span>
                      </div>
                    </td>

                    {/* Threads */}
                    <td className="py-3 px-4 text-slate-400 text-right">{p.threads ?? "—"}</td>

                    {/* Disk I/O */}
                    <td className="py-3 px-4 text-slate-400 text-right">
                      {p.io_read_bytes != null ? `${formatBytes(p.io_read_bytes)}/s` : "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                          isHighCpu
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : isElevatedCpu
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
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
