"use client";
import type { EvidenceStrength } from "@/types";
import { Shield } from "lucide-react";

interface EvidencePanelProps {
  strength: EvidenceStrength;
}

const componentDefs = [
  { key: "A", label: "Anomaly Severity",       weight: "30%", color: "from-rose-500 to-rose-600" },
  { key: "P", label: "Persistence Multiplier", weight: "25%", color: "from-amber-500 to-amber-600" },
  { key: "C", label: "Process Attribution",    weight: "20%", color: "from-blue-500 to-blue-600" },
  { key: "R", label: "Cross-Resource Corroboration", weight: "15%", color: "from-emerald-500 to-teal-600" },
  { key: "T", label: "Trend Acceleration",     weight: "10%", color: "from-sky-500 to-blue-500" },
];

export default function EvidencePanel({ strength }: EvidencePanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-xl p-6 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Shield className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
            Multi-Signal Evidence Decomposition
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
          WEIGHTED FORMULA
        </span>
      </div>

      {/* Aggregate Score Display */}
      <div className="flex items-baseline gap-3 mb-6 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 shadow-xs">
        <span className="text-4xl font-black font-mono text-emerald-600">
          {strength.score}%
        </span>
        <span className="text-xs font-mono text-slate-600">
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
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">[{key}]</span>
                  <span className="font-medium">{label}</span>
                  <span className="text-slate-400 text-[10px]">({weight})</span>
                </span>
                <span className="text-slate-900 font-bold">{val?.toFixed(0) ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                  style={{ width: `${Math.min(val ?? 0, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] font-mono text-slate-500 gap-1">
        <span>Scoring Vector: Score = 0.30A + 0.25P + 0.20C + 0.15R + 0.10T</span>
        <span>Independent Signal Corroboration</span>
      </div>
    </div>
  );
}
