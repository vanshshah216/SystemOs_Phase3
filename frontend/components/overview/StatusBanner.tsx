"use client";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ShieldCheck, Activity, Cpu } from "lucide-react";

interface StatusBannerProps {
  status: "healthy" | "warning" | "critical" | null;
  loading?: boolean;
}

const config = {
  healthy: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-gradient-to-r from-emerald-950/40 via-[#0b141e]/80 to-[#070b14]/90",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.12)]",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    label: "ALL TELEMETRY NOMINAL",
    sub: "All hardware metrics operating within dynamic statistical baseline boundaries. No persistent anomalies detected.",
    ring: "border-emerald-400/40",
    dot: "bg-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    border: "border-amber-500/40",
    bg: "bg-gradient-to-r from-amber-950/40 via-[#181510]/80 to-[#070b14]/90",
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.15)]",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    label: "METRIC INSTABILITY DETECTED",
    sub: "Telemetry exhibiting anomalous variance exceeding statistical thresholds. Tracking persistence (N=4 window).",
    ring: "border-amber-400/50",
    dot: "bg-amber-400 animate-ping",
  },
  critical: {
    icon: XCircle,
    color: "text-rose-400",
    border: "border-rose-500/50",
    bg: "bg-gradient-to-r from-rose-950/40 via-[#1d0e14]/80 to-[#070b14]/90",
    glow: "shadow-[0_0_35px_rgba(244,63,94,0.2)]",
    badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    label: "CRITICAL BOTTLENECK ACTIVE",
    sub: "Sustained anomaly threshold verified across consecutive cycles. Process attribution engine engaged.",
    ring: "border-rose-400/60",
    dot: "bg-rose-400 animate-ping",
  },
};

export default function StatusBanner({ status, loading }: StatusBannerProps) {
  if (loading || !status) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c101d]/70 backdrop-blur-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          <div className="font-mono text-xs text-gray-300">
            Syncing sovereign telemetry pipeline & rolling baseline store...
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-16 h-4 bg-white/[0.05] rounded animate-pulse" />
          <div className="w-20 h-4 bg-white/[0.05] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const c = config[status] ?? config.healthy;
  const Icon = c.icon;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${c.border} ${c.bg} ${c.glow} p-5 transition-all duration-500 backdrop-blur-xl`}>
      {/* Ambient background glow orb */}
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/[0.02] blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left side: Icon + Title + Description */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 rounded-xl border ${c.ring} bg-black/40 flex items-center justify-center shadow-inner`}>
              <Icon className={`w-6 h-6 ${c.color}`} />
            </div>
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${c.dot}`} />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-base font-extrabold font-mono tracking-widest ${c.color}`}>
                {c.label}
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${c.badgeBg}`}>
                SYSTEM EVALUATION
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {c.sub}
            </p>
          </div>
        </div>

        {/* Right side: Quick stats chips */}
        <div className="flex items-center gap-2 self-end md:self-center font-mono text-[10px]">
          <div className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/[0.08] text-gray-400 flex items-center gap-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>SAMPLE RATE: <strong className="text-gray-200">1.0s</strong></span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/[0.08] text-gray-400 flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>ALGO: <strong className="text-gray-200">Z-SCORE + P95</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
