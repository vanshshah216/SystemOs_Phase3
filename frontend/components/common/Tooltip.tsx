"use client";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

interface TooltipProps {
  term?: string;
  explanation: string;
  children?: React.ReactNode;
}

export const EXPLANATIONS: Record<string, string> = {
  "zscore": "Measures how far the current value is from its historical mean in standard deviations (Z ≥ 2.0 flags anomaly).",
  "percentile": "Historical threshold (e.g. P95) where 95% of past normal readings occurred below this level.",
  "baseline": "Dynamic statistical normal calculated continuously from recent steady-state rolling samples.",
  "persistence": "Consecutive sample filter (N=4) requiring an anomaly to stay sustained before alerting, preventing false positives from transient spikes.",
  "trend": "Linear regression slope measuring whether resource utilization is accelerating, recovering, or flat.",
  "evidence": "Multi-signal corroboration score representing consensus across statistical, persistence, and process telemetry.",
};

export default function Tooltip({ term, explanation, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const text = term && EXPLANATIONS[term.toLowerCase()] ? EXPLANATIONS[term.toLowerCase()] : explanation;

  return (
    <span className="relative inline-flex items-center">
      <span
        className="inline-flex items-center cursor-help text-slate-400 hover:text-slate-200 transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children || <HelpCircle className="w-3.5 h-3.5 ml-1 text-slate-500 hover:text-sky-400" />}
      </span>

      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs font-sans rounded-md shadow-2xl z-50 pointer-events-none leading-relaxed text-left">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </span>
      )}
    </span>
  );
}
