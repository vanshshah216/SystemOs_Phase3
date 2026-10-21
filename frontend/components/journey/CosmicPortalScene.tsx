"use client";

import React, { useState, useEffect } from "react";
import { useJourneyStore } from "@/hooks/useJourneyState";
import { sound } from "@/lib/sound";

export default function CosmicPortalScene({ progress }: { progress: number }) {
  const { jumpToScene, isHolding, setIsHolding } = useJourneyStore();
  const [chargeProgress, setChargeProgress] = useState(0);

  const start = 0.64;
  const end = 0.80;

  const inScene = progress >= start && progress <= end;
  const localP = inScene ? (progress - start) / (end - start) : 0;
  const opacity = inScene ? Math.sin(localP * Math.PI) : 0;

  // Auto-charge as user scrolls through scene 6
  useEffect(() => {
    if (inScene) {
      setChargeProgress(Math.min(1, localP * 1.5));
    }
  }, [inScene, localP]);

  const handlePointerDown = () => {
    setIsHolding(true);
    sound.startChargeDrone();
  };

  const handlePointerUp = () => {
    setIsHolding(false);
    sound.stopChargeDrone();
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isHolding && inScene) {
      timer = setInterval(() => {
        setChargeProgress((prev) => {
          if (prev >= 1) {
            sound.stopChargeDrone();
            sound.playWarpBoom();
            jumpToScene(7); // Jump into Scene 7 Cloud City Reveal
            return 1;
          }
          return prev + 0.08;
        });
      }, 50);
    }
    return () => clearInterval(timer);
  }, [isHolding, inScene, jumpToScene]);

  if (!inScene && opacity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200 overflow-hidden flex items-center justify-center select-none"
      style={{ opacity }}
    >
      {/* Deep Obsidian Space Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
        style={{
          backgroundImage: "url('/textures/clean_cosmic_ring.png')",
          transform: `scale(${1 + localP * 0.15})`,
          filter: "contrast(1.2) brightness(1.05)",
        }}
      />

      {/* Floating Nebula Stardust Particles with Parallax */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(24)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/70 blur-[0.7px] transition-transform duration-200"
            style={{
              width: `${(i % 5) + 2}px`,
              height: `${(i % 5) + 2}px`,
              top: `${(i * 13) % 95}%`,
              left: `${(i * 17) % 95}%`,
              transform: `translate(${(localP - 0.5) * (i + 5) * 35}px, ${(localP - 0.5) * (i + 5) * -25}px)`,
              opacity: 0.3 + (i % 6) * 0.12,
            }}
          />
        ))}
      </div>

      {/* Segmented Cybernetic Quantum Ring in Center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-transform"
        >
          {/* Radial emerald energy aura */}
          <div
            className="absolute w-56 h-56 rounded-full blur-3xl transition-all duration-300 pointer-events-none"
            style={{
              backgroundColor: `rgba(16, 185, 129, ${0.25 + chargeProgress * 0.7})`,
              transform: `scale(${1 + chargeProgress * 1.2})`,
            }}
          />

          {/* Rotating segmented green ring SVG */}
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
            {/* Outer segmented ring (slow rotation) */}
            <svg
              className="absolute inset-0 w-full h-full animate-spin-slow"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="16 12"
                strokeOpacity="0.8"
                fill="none"
              />
            </svg>

            {/* Inner counter-rotating segmented ring */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `rotate(${-localP * 240}deg)`,
              }}
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="36"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="12 8"
                strokeOpacity="0.9"
                fill="none"
              />
            </svg>

            {/* Main charging progress ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="28"
                className="stroke-emerald-950"
                strokeWidth="5"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="28"
                className="stroke-emerald-400 transition-all duration-75"
                strokeWidth="5"
                strokeDasharray={176}
                strokeDashoffset={176 - 176 * chargeProgress}
                strokeLinecap="round"
                fill="none"
                style={{
                  filter: "drop-shadow(0 0 12px #34d399)",
                }}
              />
            </svg>

            {/* Center prompt text / biometric ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="text-[11px] font-mono tracking-widest text-emerald-300 font-bold uppercase">
                TAP
              </span>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-medium uppercase">
                HOLD
              </span>
            </div>
          </div>

          <span className="text-[11px] font-mono text-emerald-300/80 tracking-widest mt-3 font-medium bg-black/50 px-4 py-1 rounded-full border border-emerald-500/20 backdrop-blur-md">
            Charge quantum portal jump
          </span>
        </div>
      </div>
    </div>
  );
}
