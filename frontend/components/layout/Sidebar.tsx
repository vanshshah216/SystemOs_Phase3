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
      } min-h-screen bg-white/90 backdrop-blur-2xl border-r border-[#E5EAF1] flex flex-col justify-between select-none transition-all duration-300 z-30 shrink-0 sticky top-0 h-screen shadow-xs`}
    >
      {/* Top Brand Section */}
      <div>
        <div className="h-16 border-b border-[#E5EAF1] flex items-center justify-between px-4">
          {!collapsed ? (
            <Link href="/overview" className="flex items-center gap-2.5 group">
              <img
                src="/systemos-logo.png"
                alt="SystemOS logo"
                className="systemos-logo w-9 h-9 object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              <div>
                <div className="font-mono text-base font-bold tracking-tight text-[#172033]">
                  SYSTEM<span className="text-[#2563EB]">OS</span>
                </div>
                <div className="text-[10px] text-[#667085] font-sans font-medium tracking-tight">
                  Statistical Observability
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/overview" className="mx-auto group" title="SystemOS">
              <img
                src="/systemos-logo.png"
                alt="SystemOS logo"
                className="systemos-logo w-9 h-9 object-contain mx-auto transition-transform duration-200 group-hover:scale-105"
              />
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-[#F1F4F8] text-[#667085] hover:text-[#172033] transition-colors"
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE]/80 shadow-xs"
                    : "text-[#667085] hover:text-[#172033] hover:bg-[#F8FAFC] border border-transparent"
                }`}
                title={collapsed ? label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${active ? "text-[#2563EB] scale-110" : "text-[#98A2B3]"}`} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Service Health Deck */}
      <div className="p-3 border-t border-[#E5EAF1] bg-[#F8FAFC]/90 backdrop-blur-md text-xs font-mono space-y-2">
        {!collapsed ? (
          <div className="space-y-2 py-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#98A2B3] px-1">
              Engine Status
            </div>

            {/* Collector */}
            <div className="flex items-center justify-between text-[#667085] px-1">
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <Radio className="w-3.5 h-3.5 text-[#98A2B3]" />
                Collector
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${health?.collector_running ? "bg-[#16A34A] animate-pulse" : healthError ? "bg-[#DC2626]" : "bg-[#D97706]"}`} />
                <span className={health?.collector_running ? "text-[#16A34A] font-semibold" : healthError ? "text-[#DC2626]" : "text-[#D97706]"}>
                  {health?.collector_running ? "Active" : healthError ? "Offline" : "Checking"}
                </span>
              </span>
            </div>

            {/* Database */}
            <div className="flex items-center justify-between text-[#667085] px-1">
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <Database className="w-3.5 h-3.5 text-[#98A2B3]" />
                Database
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${health?.database_ok ? "bg-[#16A34A]" : healthError ? "bg-[#DC2626]" : "bg-[#D97706]"}`} />
                <span className={health?.database_ok ? "text-[#16A34A] font-semibold" : healthError ? "text-[#DC2626]" : "text-[#D97706]"}>
                  {health?.database_ok ? "Connected" : healthError ? "Offline" : "Checking"}
                </span>
              </span>
            </div>

            {/* API */}
            <div className="flex items-center justify-between text-[#667085] px-1">
              <span className="flex items-center gap-1.5 font-sans text-xs">
                <Server className="w-3.5 h-3.5 text-[#98A2B3]" />
                FastAPI
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${healthError ? "bg-[#DC2626]" : "bg-[#16A34A]"}`} />
                <span className={healthError ? "text-[#DC2626]" : "text-[#16A34A] font-semibold"}>
                  {healthError ? "Unavailable" : "Ready"}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${health?.collector_running ? "bg-[#16A34A]" : healthError ? "bg-[#DC2626]" : "bg-[#D97706]"}`}
              title={`Collector: ${health?.collector_running ? "Active" : healthError ? "Offline" : "Checking"}`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full ${health?.database_ok ? "bg-[#16A34A]" : healthError ? "bg-[#DC2626]" : "bg-[#D97706]"}`}
              title={`Database: ${health?.database_ok ? "Connected" : healthError ? "Offline" : "Checking"}`}
            />
            <span className={`w-2.5 h-2.5 rounded-full ${healthError ? "bg-[#DC2626]" : "bg-[#16A34A]"}`} title={`API: ${healthError ? "Unavailable" : "Ready"}`} />
          </div>
        )}
      </div>
    </aside>
  );
}
