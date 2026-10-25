"use client";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

interface StatusBannerProps {
  status: "healthy" | "warning" | "critical" | null;
  loading?: boolean;
}

const config = {
  healthy: {
    icon: CheckCircle2,
    color: "text-[#16A34A]",
    border: "border-[#BBF7D0]",
    bg: "bg-[#F0FDF4]/90",
    badge: "bg-white text-[#16A34A] border-[#BBF7D0]",
    title: "System is running normally",
    description: "No sustained performance bottlenecks or anomalous spikes detected in the latest samples.",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-[#D97706]",
    border: "border-[#FDE68A]",
    bg: "bg-[#FFFBEB]/90",
    badge: "bg-white text-[#D97706] border-[#FDE68A]",
    title: "Metric variance outside usual historical range",
    description: "Statistical monitoring is active. Review measured values and diagnostic evidence for attribution context.",
  },
  critical: {
    icon: XCircle,
    color: "text-[#DC2626]",
    border: "border-[#FECACA]",
    bg: "bg-[#FEF2F2]/90",
    badge: "bg-white text-[#DC2626] border-[#FECACA]",
    title: "Sustained performance bottleneck detected",
    description: "The condition has persisted across consecutive sampling cycles. Review root-cause diagnostic evidence.",
  },
};

export default function StatusBanner({ status, loading }: StatusBannerProps) {
  if (loading || !status) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-white/80 backdrop-blur-md p-5 shadow-xs">
        <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
        <p className="text-sm font-medium text-[#667085]">Checking recent system activity…</p>
      </div>
    );
  }

  const current = config[status];
  const Icon = current.icon;

  return (
    <section className={`rounded-2xl border ${current.border} ${current.bg} p-5 backdrop-blur-md shadow-xs transition-all duration-300`}>
      <div className="flex items-start gap-3.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${current.border} bg-white shadow-2xs`}>
          <Icon className={`h-5 w-5 ${current.color}`} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-[#172033]">{current.title}</h2>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono ${current.badge}`}>
              {status.toUpperCase()}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#667085] leading-relaxed">{current.description}</p>
        </div>
      </div>
    </section>
  );
}
