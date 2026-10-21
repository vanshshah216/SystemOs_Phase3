"use client";
import type { EvidenceStrength } from "@/types";
import { Shield, Sparkles } from "lucide-react";

interface EvidencePanelProps {
  strength: EvidenceStrength;
}

const componentDefs = [
  { key: "A", label: "Anomaly Severity",       weight: "30%", color: "from-rose-500 to-red-600" },
  { key: "P", label: "Persistence Multiplier", weight: "25%", color: "from-amber-500 to-orange-600" },
  { key: "C", label: "Process Attribution",    weight: "20%", color: "from-cyan-500 to-blue-600" },
  { key: "R", label: "Cross-Resource Corroboration", weight: "15%", color: "from-emerald-500 to-teal-600" },
  { key: "T", label: "Trend Acceleration",     weight: "10%", color: "from-purple-500 to-indigo-600" },
];

export default function EvidencePanel({ strength }: EvidencePanelProps) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#090d1a]/85 backdrop-blur-xl p-6 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
            Multi-Signal Evidence Decomposition
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          WEIGHTED FORMULA
        </span>
      </div>

      {/* Aggregate Score Display */}
      <div className="flex items-baseline gap-3 mb-6 p-4 rounded-xl bg-black/40 border border-white/[0.06]">
        <span className="text-4xl font-black font-mono text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
          {strength.score}%
        </span>
        <span className="text-xs font-mono text-gray-400">
          Composite Corroboration Score (Deterministic Multi-Signal Consensus)
        </span>
      </div>

      {/* Component decomposition bars */}
      <div className="space-y-3.5">
        {componentDefs.map(({ key, label, weight, color }) => {
          const val = (strength as any)[key] as number;
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-300 flex items-center gap-1.5">
                  <span className="text-gray-500 font-bold">[{key}]</span>
                  <span>{label}</span>
                  <span className="text-gray-600 text-[10px]">({weight})</span>
                </span>
                <span className="text-gray-200 font-bold">{val?.toFixed(0) ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                  style={{ width: `${Math.min(val ?? 0, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-gray-500">
        <span>Scoring Vector: Score = 0.30A + 0.25P + 0.20C + 0.15R + 0.10T</span>
        <span>Independent Signal Corroboration</span>
      </div>
    </div>
  );
}
