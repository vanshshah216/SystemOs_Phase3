"use client";

import React from "react";
import { useJourneyStore, Landmark } from "@/hooks/useJourneyState";
import { X, ExternalLink, Cpu, ShieldCheck, Zap, Activity } from "lucide-react";
import confetti from "canvas-confetti";

export default function LandmarkModal() {
  const { selectedLandmark, setSelectedLandmark, setBetaModalOpen } = useJourneyStore();

  if (!selectedLandmark) return null;

  const handleConnect = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    setBetaModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg glass-panel-dock rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl overflow-hidden"
        style={{
          boxShadow: `0 25px 60px -15px ${selectedLandmark.color}33, 0 0 30px ${selectedLandmark.color}22`
        }}
      >
        {/* Ambient background glow orb */}
        <div
          className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: selectedLandmark.color }}
        />

        {/* Close Button */}
        <button
          onClick={() => setSelectedLandmark(null)}
          className="absolute top-5 right-5 w-8 h-8 rounded-full glass-panel-badge flex items-center justify-center text-slate-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Landmark Header */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-3.5 h-3.5 rounded-full animate-pulse shadow-lg"
            style={{ backgroundColor: selectedLandmark.color, boxShadow: `0 0 12px ${selectedLandmark.color}` }}
          />
          <span className="text-xs font-mono tracking-widest text-emerald-400 uppercase">
            {selectedLandmark.category}
          </span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3 font-serif-cinematic">
          {selectedLandmark.name}
        </h3>

        <p className="text-sm text-slate-300 leading-relaxed mb-6 font-sans">
          {selectedLandmark.description}
        </p>

        {/* Real-time Telemetry Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {selectedLandmark.stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-black/30 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center"
            >
              <span className="text-[11px] text-slate-400 font-mono uppercase mb-0.5">
                {stat.label}
              </span>
              <span className="text-sm font-semibold text-white font-mono">
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tech Stack Chips */}
        <div className="mb-6">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
            Architecture & Technologies
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedLandmark.techStack.map((tech, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-full text-xs font-mono bg-white/5 border border-white/10 text-slate-200"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleConnect}
            className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-500/25 active:scale-98 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            Connect Sovereign Node (+100 XP)
          </button>
          <button
            onClick={() => setSelectedLandmark(null)}
            className="py-3 px-5 rounded-2xl glass-panel-badge text-sm text-slate-300 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
