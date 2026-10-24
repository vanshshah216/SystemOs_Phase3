"use client";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

interface StatusBannerProps {
  status: "healthy" | "warning" | "critical" | null;
  loading?: boolean;
}

const config = {
  healthy: {
    icon: CheckCircle2,
    color: "text-slate-300",
    border: "border-[#29323d]",
    bg: "bg-[#151b23]",
    badge: "bg-slate-500/10 text-slate-300 border-slate-700",
    title: "System is running normally",
    description: "No sustained performance issues detected in the latest samples.",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-300",
    border: "border-amber-500/25",
    bg: "bg-[#171a1d]",
    badge: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    title: "A metric is outside its usual range",
    description: "Monitoring continues. Review the measured values and diagnostic evidence for context.",
  },
  critical: {
    icon: XCircle,
    color: "text-rose-300",
    border: "border-rose-500/30",
    bg: "bg-[#1a171a]",
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    title: "Sustained performance issue detected",
    description: "The condition has persisted across multiple samples. Review the diagnostic evidence before taking action.",
  },
};

export default function StatusBanner({ status, loading }: StatusBannerProps) {
  if (loading || !status) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#29323d] bg-[#151b23] p-5">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <p className="text-sm text-slate-300">Checking recent system activity…</p>
      </div>
    );
  }

  const current = config[status];
  const Icon = current.icon;

  return (
    <section className={`rounded-xl border ${current.border} ${current.bg} p-5`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#303a46] bg-[#11171f]">
          <Icon className={`h-5 w-5 ${current.color}`} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100">{current.title}</h2>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${current.badge}`}>
              {status === "healthy" ? "Up to date" : status === "warning" ? "Review" : "Attention"}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">{current.description}</p>
        </div>
      </div>
    </section>
  );
}
