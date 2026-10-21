"use client";

import React from "react";

export default function CloudRevealScene({ progress }: { progress: number }) {
  const start = 0.76;
  const end = 0.90;

  if (progress < start || progress > end) return null;

  const localP = (progress - start) / (end - start);
  const opacity = Math.sin(localP * Math.PI);

  // Cloud parting split: left & right clouds move outward
  const cloudOffset = localP * 120;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200 overflow-hidden flex items-center justify-center select-none"
      style={{ opacity }}
    >
      {/* Background Aerial City emerging from clouds */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
        style={{
          backgroundImage: "url('/textures/clean_city_reveal.png')",
          transform: `scale(${1.08 - localP * 0.08}) translateY(${(localP - 0.5) * -30}px)`,
          filter: "contrast(1.08) brightness(1.05)",
        }}
      />

      {/* Parting Volumetric White Cloud Layer */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-white/95 transition-transform duration-500"
        style={{
          opacity: Math.max(0, 1 - localP * 1.5),
          transform: `translateX(${cloudOffset}px)`,
        }}
      />

      {/* Cinematic Typography: "Introducing" -> "zero" */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
        {localP < 0.55 ? (
          <div
            className="transition-all duration-300"
            style={{
              transform: `scale(${0.95 + localP * 0.1}) translateY(${(localP - 0.25) * -20}px)`,
              opacity: Math.min(1, (0.55 - localP) * 3),
            }}
          >
            <h1 className="text-6xl sm:text-8xl lg:text-9xl font-serif-cinematic italic text-emerald-950/90 font-normal tracking-tight drop-shadow-lg">
              Introducing
            </h1>
          </div>
        ) : (
          <div
            className="transition-all duration-300"
            style={{
              transform: `scale(${1 + (localP - 0.55) * 0.15})`,
              opacity: Math.min(1, (localP - 0.55) * 3),
            }}
          >
            <h2 className="text-7xl sm:text-9xl lg:text-[11rem] font-bold font-sans tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 drop-shadow-[0_0_35px_rgba(6,182,212,0.6)]">
              zero
            </h2>
            <span className="block text-sm sm:text-base font-mono uppercase tracking-[0.3em] text-slate-700 font-semibold mt-2">
              The Sovereign University Metropolis
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
