"use client";

import React, { useState } from "react";
import { useJourneyStore } from "@/hooks/useJourneyState";
import { X, Sparkles, CheckCircle2, Shield, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { sound } from "@/lib/sound";

export default function BetaModal() {
  const { betaModalOpen, setBetaModalOpen } = useJourneyStore();
  const [email, setEmail] = useState("");
  const [track, setTrack] = useState("ai-systems");
  const [submitted, setSubmitted] = useState(false);

  if (!betaModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    sound.playSparkle();
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#ffffff"]
    });
    setSubmitted(true);
  };

  const handleClose = () => {
    setBetaModalOpen(false);
    setTimeout(() => {
      setSubmitted(false);
      setEmail("");
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md glass-panel-dock rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        {/* Glowing top line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full glass-panel-badge flex items-center justify-center text-slate-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {!submitted ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                GENESIS INVITATIONAL
              </span>
              <span className="text-xs text-amber-400 font-mono font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> +100 XP
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 font-serif-cinematic">
              Join Zero Beta
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 font-sans">
              Enter the sovereign engineering matrix. Access interactive digital world models, distributed compute clusters, and private community nodes.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Engineering Discipline
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "ai-systems", label: "AI Systems" },
                    { id: "spatial-web", label: "Spatial Web" },
                    { id: "sovereign-os", label: "Kernel / OS" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTrack(item.id)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-mono transition-all border ${
                        track === item.id
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-medium"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Primary Contact Handle / Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.xyz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-400 transition-colors font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm tracking-wide transition-all duration-200 shadow-xl shadow-emerald-500/25 active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Request Matrix Access Key</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2 font-serif-cinematic">
              Genesis Key Queued
            </h3>
            <p className="text-sm text-slate-300 max-w-xs mx-auto mb-6">
              Welcome to Zero. Your cryptographic signature is recorded on the sovereign ledger.
            </p>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 mb-6 text-xs font-mono text-emerald-300">
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-slate-400">STATUS:</span>
                <span>VERIFIED</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-slate-400">DISCIPLINE:</span>
                <span className="uppercase">{track}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">REWARD:</span>
                <span className="text-amber-400">+100 XP GRANTED</span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors"
            >
              Continue Exploration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
