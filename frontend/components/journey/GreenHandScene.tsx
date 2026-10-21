"use client";

import React from "react";
import { calcSceneOpacity, calcLocalProgress } from "@/lib/animation";

export default function GreenHandScene({ progress }: { progress: number }) {
  // Scene 3 is active from 0.18 to 0.35
  const start = 0.18;
  const fadeInEnd = 0.22;
  const fadeOutStart = 0.31;
  const end = 0.35;

  const opacity = calcSceneOpacity(progress, start, fadeInEnd, fadeOutStart, end);
  if (opacity <= 0.005) return null;

  // Local progress 0 to 1 inside scene 3
  const localP = calcLocalProgress(progress, start, end);

  // Camera zoom and perspective rotation
  const scale = 0.95 + localP * 0.45;
  const rotateZ = (localP - 0.5) * 12;
  const translateY = (localP - 0.5) * -50;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200 overflow-hidden flex items-center justify-center select-none"
      style={{ opacity }}
    >
      {/* Background High-Key Pastel Teal Atmosphere */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
        style={{
          backgroundImage: "url('/textures/clean_green_hand.png')",
          transform: `scale(${scale}) translateY(${translateY}px) rotate(${rotateZ * 0.3}deg)`,
          filter: "contrast(1.05) brightness(1.02)",
        }}
      />

      {/* Orbiting 3D floating wafers / capsules */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { top: "25%", left: "35%", w: "45px", h: "18px", rot: "25deg", speed: 0.8 },
          { top: "60%", left: "30%", w: "52px", h: "20px", rot: "-35deg", speed: 1.2 },
          { top: "30%", left: "68%", w: "40px", h: "16px", rot: "45deg", speed: 0.6 },
          { top: "72%", left: "62%", w: "48px", h: "18px", rot: "-20deg", speed: 1.4 },
          { top: "45%", left: "22%", w: "36px", h: "14px", rot: "15deg", speed: 0.9 },
        ].map((capsule, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/90 border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-transform duration-150"
            style={{
              top: capsule.top,
              left: capsule.left,
              width: capsule.w,
              height: capsule.h,
              transform: `translate(${(localP - 0.5) * capsule.speed * 80}px, ${(localP - 0.5) * capsule.speed * -40}px) rotate(${capsule.rot})`,
            }}
          />
        ))}
      </div>

      {/* Floating Cherry Blossom Petals */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(14)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-pink-300/60 blur-[0.5px] transition-transform duration-300"
            style={{
              width: `${8 + (i % 6)}px`,
              height: `${12 + (i % 8)}px`,
              top: `${(i * 17) % 85}%`,
              left: `${(i * 21) % 90}%`,
              borderRadius: "50% 20% 50% 20%",
              transform: `translate(${(localP - 0.5) * (i + 5) * 20}px, ${(localP - 0.5) * (i + 5) * -15}px) rotate(${(localP * 180 + i * 40)}deg)`,
            }}
          />
        ))}
      </div>

      {/* Cinematic Editorial Typography from Reference */}
      <div className="absolute inset-0 flex flex-col justify-between p-8 sm:p-16 pointer-events-none">
        {/* Top-Left: "College would" */}
        <div
          className="transition-transform duration-300 max-w-sm"
          style={{
            transform: `translateY(${(1 - localP) * 35}px) translateX(${(localP - 0.5) * -20}px)`,
            opacity: Math.min(1, localP * 2.5),
          }}
        >
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-serif-cinematic italic text-emerald-950 font-normal leading-none tracking-tight drop-shadow-sm">
            College
          </h1>
          <span className="block text-2xl sm:text-4xl font-serif-cinematic text-emerald-800/80 italic ml-6 mt-1 font-light">
            would
          </span>
        </div>

        {/* Bottom-Right: "land You" */}
        <div
          className="self-end text-right transition-transform duration-300 max-w-sm mb-12 sm:mb-16"
          style={{
            transform: `translateY(${(localP - 1) * -35}px) translateX(${(localP - 0.5) * 20}px)`,
            opacity: Math.min(1, localP * 2.5),
          }}
        >
          <span className="block text-xl sm:text-3xl font-serif-cinematic text-emerald-800/80 italic mr-6 font-light">
            land
          </span>
          <h2 className="text-6xl sm:text-8xl lg:text-9xl font-serif-cinematic italic text-emerald-600 font-normal leading-none tracking-tight">
            You
          </h2>
        </div>
      </div>
    </div>
  );
}
