"use client";

import React from "react";

export default function BloomTransition({ progress }: { progress: number }) {
  // Peak intensity around progress 0.16
  const intensity = Math.max(
    0,
    1 - Math.abs(progress - 0.17) / 0.08
  );

  if (intensity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center transition-opacity"
      style={{ opacity: intensity }}
    >
      {/* High-intensity pure white / green bloom burst */}
      <div
        className="absolute inset-0 bg-radial from-white via-emerald-100/80 to-transparent transition-transform duration-200"
        style={{
          transform: `scale(${1 + intensity * 2})`,
          filter: "blur(20px)"
        }}
      />

      {/* Volumetric radial rays */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/90 via-emerald-400/40 to-transparent mix-blend-screen" />

      {/* Center intense flash */}
      <div
        className="w-96 h-96 rounded-full bg-white shadow-[0_0_120px_60px_#ffffff] transition-all"
        style={{
          transform: `scale(${0.5 + intensity * 2.5})`,
          opacity: intensity
        }}
      />
    </div>
  );
}
