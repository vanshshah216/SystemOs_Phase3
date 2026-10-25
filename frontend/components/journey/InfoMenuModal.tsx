"use client";

import React from "react";
import { useJourneyStore } from "@/hooks/useJourneyState";
import { X, Volume2, VolumeX, Keyboard, Compass, LayoutDashboard, Sparkles } from "lucide-react";
import Link from "next/link";
import { sound } from "@/lib/sound";

export default function InfoMenuModal() {
  const { infoMenuOpen, setInfoMenuOpen, isMuted, toggleMuted, xp, jumpToScene } = useJourneyStore();

  if (!infoMenuOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel-dock rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setInfoMenuOpen(false)}
          className="absolute top-5 right-5 w-8 h-8 rounded-full glass-panel-badge flex items-center justify-center text-slate-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            SYSTEM TELEMETRY
          </span>
          <span className="text-xs text-amber-400 font-mono font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {xp} XP EARNED
          </span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 font-serif-cinematic">
          Zero University
        </h3>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 font-sans">
          A continuous scroll-driven cinematic spatial journey from organic depths to the sovereign tech metropolis. Designed as an interactive alternative to traditional static learning and tech institutions.
        </p>

        {/* Keyboard & Mouse Navigation Guide */}
        <div className="mb-6 bg-black/30 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider mb-3">
            <Keyboard className="w-4 h-4" />
            <span>Interactive Controls</span>
          </div>

          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Scroll Wheel / Trackpad</span>
              <span>Scrub 8-Scene World Timeline</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Mouse Drag / Joystick</span>
              <span>Pan City Aerial Camera</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Plus (+) / Minus (-) / Keys</span>
              <span>Zoom In & Out</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-400">Tap & Hold Rings</span>
              <span>Charge Quantum Energy Portals</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">City Landmark Pins</span>
              <span>Focus & Inspect Tech Campuses</span>
            </div>
          </div>
        </div>

        {/* Quick Links & Audio */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => {
              const muted = sound.toggleMute();
              toggleMuted();
            }}
            className="py-3 px-4 rounded-2xl glass-panel-badge flex items-center justify-center gap-2 text-xs font-mono text-slate-200 hover:text-emerald-400 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? "Audio: Muted" : "Audio: Active"}</span>
          </button>

          <Link
            href="/overview"
            className="py-3 px-4 rounded-2xl glass-panel-badge flex items-center justify-center gap-2 text-xs font-mono text-slate-200 hover:text-cyan-400 transition-colors"
          >
            <img src="/systemos-logo.png" alt="SystemOS logo" className="systemos-logo w-4 h-4 object-contain" />
            <span>SystemOS Monitor</span>
          </Link>
        </div>

        <button
          onClick={() => setInfoMenuOpen(false)}
          className="w-full py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors font-mono"
        >
          Return to Experience
        </button>
      </div>
    </div>
  );
}
