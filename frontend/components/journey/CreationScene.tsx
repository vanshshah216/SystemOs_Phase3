"use client";

import React, { useState, useEffect } from "react";
import { useJourneyStore } from "@/hooks/useJourneyState";
import { sound } from "@/lib/sound";
import { calcSceneOpacity, calcLocalProgress } from "@/lib/animation";

export default function CreationScene({ progress }: { progress: number }) {
  const { jumpToScene, isHolding, setIsHolding } = useJourneyStore();
  const [localHold, setLocalHold] = useState(0);

  const start = 0.35;
  const fadeInEnd = 0.39;
  const fadeOutStart = 0.47;
  const end = 0.51;

  const opacity = calcSceneOpacity(progress, start, fadeInEnd, fadeOutStart, end);
  const inScene = opacity > 0.005;
  const localP = calcLocalProgress(progress, start, end);

  // Auto-fill hold progress as user scrolls through scene 4
  useEffect(() => {
    if (inScene) {
      setLocalHold(Math.min(1, localP * 1.4));
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
        setLocalHold((prev) => {
          if (prev >= 1) {
            sound.stopChargeDrone();
            sound.playShatter();
            jumpToScene(5); // Advance to Scene 5 Red Shatter
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
      {/* Background Classical Landscape with Roman Columns */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500"
        style={{
          backgroundImage: "url('/textures/clean_adam_landscape.png')",
          transform: `scale(${1.02 + localP * 0.12}) translateY(${(localP - 0.5) * -20}px)`,
          filter: "contrast(1.05) brightness(1.03)",
        }}
      />

      {/* Floating Cherry Blossom Petals in Landscape */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-pink-300/70 blur-[0.5px] transition-transform duration-300"
            style={{
              width: `${10 + (i % 8)}px`,
              height: `${14 + (i % 10)}px`,
              top: `${(i * 13) % 90}%`,
              left: `${(i * 19) % 90}%`,
              borderRadius: "45% 20% 45% 20%",
              transform: `translate(${(localP - 0.5) * (i + 4) * 25}px, ${(localP - 0.5) * (i + 4) * -18}px) rotate(${localP * 240 + i * 35}deg)`,
            }}
          />
        ))}
      </div>

      {/* Center Interactive Fingertip Touch Ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative flex flex-col items-center justify-center cursor-pointer group active:scale-95 transition-transform"
        >
          {/* Radial aura glow */}
          <div
            className="absolute w-40 h-40 rounded-full blur-2xl transition-all duration-300 pointer-events-none"
            style={{
              backgroundColor: `rgba(255, 255, 255, ${0.4 + localHold * 0.6})`,
              transform: `scale(${1 + localHold * 0.8})`,
            }}
          />

          {/* SVG Progress Ring */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background circle track */}
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-white/30"
                strokeWidth="4"
                fill="none"
              />
              {/* Charging energy circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-white transition-all duration-75"
                strokeWidth="5"
                strokeDasharray={264}
                strokeDashoffset={264 - 264 * localHold}
                strokeLinecap="round"
                fill="none"
                style={{
                  filter: "drop-shadow(0 0 10px #ffffff)",
                }}
              />
            </svg>

            {/* Center prompt text / hand icon */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="text-[11px] font-mono tracking-widest text-slate-800 font-bold uppercase">
                TAP
              </span>
              <span className="text-[10px] font-mono tracking-widest text-slate-700 font-semibold uppercase">
                & HOLD
              </span>
            </div>
          </div>

          <span className="text-[11px] font-mono text-slate-700/80 tracking-widest mt-2 font-medium bg-white/40 px-3 py-0.5 rounded-full backdrop-blur-sm">
            Touch or scroll to bridge connection
          </span>
        </div>
      </div>
    </div>
  );
}
