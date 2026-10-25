"use client";
import TopBar from "@/components/layout/TopBar";
import MetricCard from "@/components/overview/MetricCard";
import SystemHealthCard from "@/components/overview/SystemHealthCard";
import LivePerformanceSection from "@/components/overview/LivePerformanceSection";
import CurrentDiagnosisSection from "@/components/overview/CurrentDiagnosisSection";
import TopProcessesSection from "@/components/overview/TopProcessesSection";
import RecentEventsSection from "@/components/overview/RecentEventsSection";
import DemoPanel from "@/components/demo/DemoPanel";
import PreventionAndRecovery from "@/components/diagnosis/PreventionAndRecovery";
import { useCurrentMetrics } from "@/hooks/useMetrics";
import { useEvents } from "@/hooks/useEvents";
import { formatPct, formatBytes, formatBytesPerSec } from "@/lib/utils";

export default function OverviewPage() {
  const { data: metrics, loading: metricsLoading } = useCurrentMetrics(2500);
  const { events, loading: eventsLoading } = useEvents(3500);

  const activeEvents = events.filter(e => e.status === "active");
  const latestActive = activeEvents[0] ?? null;

  const cpuTrend: "up" | "down" | "flat" | null = metrics?.cpu_context?.trend_slope != null
    ? metrics.cpu_context.trend_slope > 0.5 ? "up"
    : metrics.cpu_context.trend_slope < -0.5 ? "down" : "flat"
    : null;

  const ramTrend: "up" | "down" | "flat" | null = metrics?.ram_context?.trend_slope != null
    ? metrics.ram_context.trend_slope > 0.02 ? "up"
    : metrics.ram_context.trend_slope < -0.02 ? "down" : "flat"
    : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFCFF]">
      {/* Sticky Clean Header */}
      <TopBar title="Overview" subtitle="Real-Time System Telemetry" />

      {/* Spacious Main Scrollable Content Container */}
      <main className="flex-1 px-6 sm:px-8 lg:px-10 py-8 max-w-[1440px] w-full mx-auto space-y-8 animate-fade-in-up">
        {/* SECTION 1: System Overview Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-xs font-mono font-bold tracking-wider text-[#2563EB] uppercase">
                Host Performance Dashboard
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033] font-sans">
              System Telemetry Overview
            </h2>
            <p className="text-sm text-[#667085] font-sans mt-1">
              Statistical performance baselines, persistence tracking, and explainable root-cause diagnosis.
            </p>
          </div>
        </div>

        {/* SECTION 2: Four Core Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            label="CPU"
            currentValue={metrics?.cpu_percent}
            formattedValue={formatPct(metrics?.cpu_percent) ?? "—"}
            unit="%"
            context={metrics?.cpu_context}
            trend={cpuTrend}
            baselineFormatter={v => `${v.toFixed(1)}%`}
          />
          <MetricCard
            label="RAM"
            currentValue={metrics?.ram_percent}
            formattedValue={formatPct(metrics?.ram_percent) ?? "—"}
            unit="%"
            context={metrics?.ram_context}
            trend={ramTrend}
            baselineFormatter={v => `${v.toFixed(1)}%`}
          />
          <MetricCard
            label="DISK"
            currentValue={metrics?.disk_read_bytes}
            formattedValue={formatBytesPerSec(metrics?.disk_read_bytes)}
            unit=""
            context={metrics?.disk_read_context}
            baselineFormatter={v => `${formatBytes(v)}/s`}
          />
          <MetricCard
            label="NETWORK"
            currentValue={metrics?.network_recv_bytes}
            formattedValue={formatBytesPerSec(metrics?.network_recv_bytes)}
            unit=""
            context={metrics?.net_context}
            baselineFormatter={v => `${formatBytes(v)}/s`}
          />
        </div>

        {/* SECTION 3: System Health Card */}
        <SystemHealthCard
          metrics={metrics}
          activeEvents={activeEvents}
          loading={metricsLoading}
        />

        {/* SECTION 4: Live Performance Chart */}
        <LivePerformanceSection />

        {/* SECTION 5: Current Diagnosis */}
        <CurrentDiagnosisSection
          activeEvent={latestActive}
          loading={eventsLoading}
        />

        {/* SECTION 5.5: Recommended Prevention & Recovery Monitoring */}
        {latestActive && (
          <PreventionAndRecovery event={latestActive} />
        )}

        {/* SECTION 6: Top Processes Table */}
        <TopProcessesSection />

        {/* SECTION 7: Recent Events */}
        <RecentEventsSection
          events={events}
          loading={eventsLoading}
        />

        {/* SECTION 8: Demo Simulation Panel */}
        <DemoPanel />
      </main>
    </div>
  );
}
