"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Cpu,
  AlertTriangle,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Server,
  Database,
  Radio
} from "lucide-react";
import { useHealth } from "@/hooks/useMetrics";

const navItems = [
  { href: "/overview",    label: "Overview",      icon: LayoutDashboard },
  { href: "/live",        label: "Live Metrics",  icon: Activity },
  { href: "/processes",   label: "Processes",     icon: Cpu },
  { href: "/diagnostics", label: "Diagnostics",   icon: AlertTriangle },
  { href: "/events",      label: "Event History", icon: History },
  { href: "/settings",    label: "Settings",      icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { health, error: healthError } = useHealth();

  if (pathname === "/journey") {
    return null;
  }

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } min-h-screen bg-[#11171f] border-r border-[#29323d] flex flex-col justify-between select-none transition-all duration-300 z-30 shrink-0 sticky top-0 h-screen`}
    >
      {/* Top Brand Section */}
      <div>
        <div className="h-16 border-b border-[#29323d] flex items-center justify-between px-4">
          {!collapsed ? (
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-mono font-bold text-xs">
                  S
                </div>
                <span className="font-mono text-base font-bold tracking-wider text-slate-100">
                  SYSTEM<span className="text-sky-400">OS</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-sans tracking-tight">
                Statistical Performance Monitoring
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-mono font-bold text-sm mx-auto">
              S
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/overview" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
                title={collapsed ? label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-sky-400" : "text-slate-400"}`} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Service Health Deck */}
      <div className="p-3 border-t border-[#29323d] bg-[#090e18] text-xs font-mono space-y-2">
        {!collapsed ? (
          <div className="space-y-2 py-1">
            {/* Collector */}
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-slate-500" />
                Collector
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${health?.collector_running ? "bg-slate-500" : healthError ? "bg-amber-400" : "bg-slate-600"}`} />
                <span className={health?.collector_running ? "text-slate-300" : healthError ? "text-amber-300" : "text-slate-400"}>
                  {health?.collector_running ? "Running" : healthError ? "Unavailable" : "Checking"}
                </span>
              </span>
            </div>

            {/* Database */}
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Database
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${health?.database_ok ? "bg-slate-500" : healthError ? "bg-amber-400" : "bg-slate-600"}`} />
                <span className={health?.database_ok ? "text-slate-300" : healthError ? "text-amber-300" : "text-slate-400"}>
                  {health?.database_ok ? "Connected" : healthError ? "Unavailable" : "Checking"}
                </span>
              </span>
            </div>

            {/* API */}
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                API
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${healthError ? "bg-amber-400" : "bg-slate-500"}`} />
                <span className={healthError ? "text-amber-300" : "text-slate-300"}>
                  {healthError ? "Unavailable" : "Available"}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${health?.collector_running ? "bg-slate-500" : healthError ? "bg-amber-400" : "bg-slate-600"}`}
              title={`Collector: ${health?.collector_running ? "Running" : healthError ? "Unavailable" : "Checking"}`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full ${health?.database_ok ? "bg-slate-500" : healthError ? "bg-amber-400" : "bg-slate-600"}`}
              title={`Database: ${health?.database_ok ? "Connected" : healthError ? "Unavailable" : "Checking"}`}
            />
            <span className={`w-2.5 h-2.5 rounded-full ${healthError ? "bg-amber-400" : "bg-slate-500"}`} title={`API: ${healthError ? "Unavailable" : "Available"}`} />
          </div>
        )}
      </div>
    </aside>
  );
}
