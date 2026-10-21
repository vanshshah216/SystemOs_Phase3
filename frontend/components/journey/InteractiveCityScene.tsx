"use client";

import React, { useRef, useState, useEffect } from "react";
import { useJourneyStore, LANDMARKS, Landmark } from "@/hooks/useJourneyState";
import { sound } from "@/lib/sound";
import { MapPin, Sparkles, ChevronRight, Zap } from "lucide-react";

export default function InteractiveCityScene({ progress }: { progress: number }) {
  const {
    activeScene,
    cameraPos,
    panCamera,
    zoomCamera,
    setSelectedLandmark,
    setBetaModalOpen
  } = useJourneyStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredLandmark, setHoveredLandmark] = useState<Landmark | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Scene 8 is active from 0.82 to 1.0
  const start = 0.82;
  const inScene = progress >= start;
  const localP = inScene ? Math.min(1, (progress - start) / 0.12) : 0;
  const opacity = inScene ? localP : 0;

  // Handle direct mouse / touch drag-to-pan
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag if not clicking a button/pin
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    panCamera(dx * 0.7, dy * 0.7);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  if (opacity <= 0.01) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`absolute inset-0 z-20 overflow-hidden select-none transition-opacity duration-300 ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ opacity }}
    >
      {/* City World Canvas Container with Camera Pan & Zoom */}
      <div
        className="absolute inset-[-35%] w-[170%] h-[170%] transition-transform duration-100 ease-out will-change-transform"
        style={{
          transform: `translate3d(${cameraPos.x}px, ${cameraPos.y}px, 0) scale(${cameraPos.zoom})`,
          transformOrigin: "center center",
        }}
      >
        {/* Sprawling High-Res Isometric Aerial Metropolis Texture */}
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/textures/clean_city_map.png')",
            filter: "contrast(1.06) brightness(1.02)",
          }}
        />

        {/* ── CENTRAL GLOWING GREEN HOLOGRAPHIC CYLINDER & BEAM ─────────────────── */}
        <div
          className="absolute left-[49.5%] top-[51.5%] -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
          onClick={() => {
            sound.playSparkle();
            setBetaModalOpen(true);
          }}
        >
          {/* Vertical Stratospheric Green Laser Beam */}
          <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-8 sm:w-12 h-[800px] bg-gradient-to-t from-emerald-400/80 via-emerald-400/30 to-transparent blur-md pointer-events-none" />

          {/* Ascending Pulsing Energy Rings */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-32 h-12 rounded-full border border-emerald-400/60 shadow-[0_0_20px_#34d399] animate-pulse pointer-events-none" />
          <div className="absolute -top-64 left-1/2 -translate-x-1/2 w-44 h-16 rounded-full border border-emerald-400/40 shadow-[0_0_30px_#34d399] animate-pulse pointer-events-none delay-300" />

          {/* Rotating Holographic Emerald Cylinder with 3D Text */}
          <div className="relative w-48 h-32 sm:w-60 sm:h-40 flex items-center justify-center">
            {/* Ground glow pool */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/35 blur-xl animate-pulse-slow" />

            {/* Cylinder hologram walls */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-400/80 bg-gradient-to-t from-emerald-500/20 via-emerald-400/10 to-transparent shadow-[0_0_40px_rgba(52,211,153,0.6)]" />

            {/* Rotating Hologram Text Ring: "JOIN THE WAITLIST • +100 XP •" */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full">
              <div className="text-center font-mono font-black text-xs sm:text-sm tracking-[0.25em] text-emerald-300 drop-shadow-[0_0_12px_#34d399] animate-pulse">
                <span className="block text-[11px] text-emerald-200 uppercase font-bold">
                  ★ JOIN THE WAITLIST ★
                </span>
                <span className="block text-[10px] text-emerald-400 mt-1">
                  +100 XP REWARD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── INTERACTIVE CAMPUS LANDMARK PINS ──────────────────────────────────── */}
        {LANDMARKS.map((landmark) => {
          if (landmark.id === "waitlist_dome") return null; // handled above

          const isHovered = hoveredLandmark?.id === landmark.id;

          return (
            <div
              key={landmark.id}
              className="absolute pointer-events-auto transition-transform duration-200 z-30"
              style={{
                left: `${landmark.x}%`,
                top: `${landmark.y}%`,
                transform: `translate(-50%, -50%) scale(${isHovered ? 1.25 : 1})`,
              }}
              onMouseEnter={() => setHoveredLandmark(landmark)}
              onMouseLeave={() => setHoveredLandmark(null)}
              onClick={() => {
                sound.playSparkle();
                setSelectedLandmark(landmark);
              }}
            >
              {/* Radar pulse ring */}
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-60 pointer-events-none"
                style={{
                  backgroundColor: landmark.color,
                  animationDuration: "2.5s",
                }}
              />

              {/* Pin Button */}
              <button
                className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 border border-white/60 active:scale-90"
                style={{
                  backgroundColor: landmark.color,
                  boxShadow: `0 0 16px ${landmark.color}aa, 0 4px 12px rgba(0,0,0,0.5)`,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
              </button>

              {/* Hover Tooltip Telemetry Card */}
              {isHovered && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 glass-panel-dock rounded-2xl p-3 border border-white/20 shadow-2xl backdrop-blur-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: landmark.color }}
                    />
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                      {landmark.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-serif-cinematic mb-1">
                    {landmark.name}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mb-2 font-sans">
                    {landmark.description}
                  </p>
                  <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-[10px] font-mono text-emerald-300">
                    <span>Click to inspect</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Atmospheric Horizon Light & Fog */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

      {/* Bottom Hint Banner */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="glass-panel-badge px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/15 text-slate-300 text-xs font-mono backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Interactive Metropolis • Drag to pan • Click landmarks</span>
        </div>
      </div>
    </div>
  );
}
