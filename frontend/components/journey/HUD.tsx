"use client";

import React, { useState, useEffect } from "react";
import { useJourneyStore, LANDMARKS } from "@/hooks/useJourneyState";
import { sound } from "@/lib/sound";
import {
  Volume2,
  VolumeX,
  Compass,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Layers,
  X,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Menu
} from "lucide-react";

export default function HUD() {
  const {
    activeScene,
    xp,
    depthBZ,
    isMuted,
    toggleMuted,
    setBetaModalOpen,
    setInfoMenuOpen,
    cameraPos,
    panCamera,
    zoomCamera,
    resetCamera,
    jumpToScene,
    scrollProgress
  } = useJourneyStore();

  const [sceneMenuOpen, setSceneMenuOpen] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });

  // Handle virtual joystick drag
  const handleJoystickMove = (clientX: number, clientY: number, rect: DOMRect) => {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 12;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: nx, y: ny });
    // Invert for camera pan: dragging right moves view
    panCamera(-nx * 0.12, -ny * 0.12);
  };

  const onJoystickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setJoystickActive(true);
    const rect = e.currentTarget.getBoundingClientRect();
    handleJoystickMove(e.clientX, e.clientY, rect);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleJoystickMove(moveEvent.clientX, moveEvent.clientY, rect);
    };

    const handleMouseUp = () => {
      setJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const onJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setJoystickActive(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    handleJoystickMove(touch.clientX, touch.clientY, rect);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const t = moveEvent.touches[0];
      handleJoystickMove(t.clientX, t.clientY, rect);
    };

    const handleTouchEnd = () => {
      setJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  };

  const sceneNames = [
    "Scene 1: Underwater Caustics",
    "Scene 2: Organic Glow Transition",
    "Scene 3: Floating Green Hand",
    "Scene 4: Elysian Creation Landscape",
    "Scene 5: Crimson Crystal Shatter",
    "Scene 6: Cosmic Nebula Portal",
    "Scene 7: Volumetric Cloud Reveal",
    "Scene 8: Interactive Tech Metropolis"
  ];

  return (
    <div className="fixed inset-0 pointer-events-none z-40 select-none overflow-hidden font-sans">
      {/* ── TOP BAR ───────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 p-4 md:p-6 flex items-center justify-between">
        {/* Left: Minimal curved brand logo / Scene Quick Jump */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => setSceneMenuOpen(!sceneMenuOpen)}
            className="w-10 h-10 rounded-full glass-panel-badge flex items-center justify-center text-slate-200 hover:text-emerald-400 hover:border-emerald-500/50 transition-all duration-200 active:scale-95 shadow-lg group"
            title="Scene Navigation"
          >
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
              <path d="M4.93 4.93l14.14 14.14" />
            </svg>
          </button>

          {/* Quick Scene Dropdown */}
          {sceneMenuOpen && (
            <div className="absolute top-16 left-4 md:left-6 w-72 glass-panel-dock rounded-2xl p-3 border border-white/10 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/10 text-xs font-mono text-emerald-400 tracking-wider">
                <span>SCENE JUMP CHRONOLOGY</span>
                <button
                  onClick={() => setSceneMenuOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {sceneNames.map((name, idx) => {
                  const sceneNum = idx + 1;
                  const isActive = activeScene === sceneNum;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        jumpToScene(sceneNum);
                        setSceneMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      <span className="font-mono text-[10px] text-slate-400 ml-2">
                        0{sceneNum}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Center: Real-time Depth Ticker & Compass Ruler */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 px-4 py-1.5 glass-panel-badge rounded-full border border-white/10">
            {/* Tick marks ruler */}
            <div className="flex items-center gap-1 opacity-60">
              <span className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
              <span className="w-0.5 h-2 bg-slate-400 rounded-full" />
              <span className="w-0.5 h-3 bg-emerald-400 rounded-full" />
              <span className="w-0.5 h-2 bg-slate-400 rounded-full" />
              <span className="w-0.5 h-1.5 bg-slate-400 rounded-full" />
            </div>
            <span className="text-xs font-mono tracking-widest text-slate-200 ml-1.5 font-medium">
              {depthBZ} BZ
            </span>
          </div>
          {/* Subtle scroll progress line */}
          <div className="w-24 h-0.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${Math.round(scrollProgress * 100)}%` }}
            />
          </div>
        </div>

        {/* Right: XP Badge & Audio Toggle */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* XP Pill Badge */}
          <div className="glass-panel-badge px-3.5 py-1.5 rounded-full flex items-center gap-2 border border-amber-400/30 text-amber-300 font-mono text-xs font-semibold shadow-lg shadow-amber-500/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{xp} XP</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const muted = sound.toggleMute();
              toggleMuted();
            }}
            className="w-10 h-10 rounded-full glass-panel-badge flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-all active:scale-95"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </header>

      {/* ── BOTTOM DOCK ───────────────────────────────────────────────────────── */}
      <footer className="absolute bottom-5 left-0 right-0 flex items-center justify-center px-4">
        <div className="glass-panel-dock rounded-full px-2 py-1.5 flex items-center gap-2 pointer-events-auto shadow-2xl border border-white/15">
          {/* Glowing emerald orb */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-pulse-slow">
            <div className="w-4 h-4 rounded-full bg-white/30 backdrop-blur-sm" />
          </div>

          {/* Join Beta Button */}
          <button
            onClick={() => setBetaModalOpen(true)}
            className="px-6 py-2 rounded-full bg-transparent hover:bg-white/10 text-sm font-medium text-white transition-all duration-200 active:scale-95 tracking-wide"
          >
            Join Beta
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/15" />

          {/* Menu button */}
          <button
            onClick={() => setInfoMenuOpen(true)}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Menu & Controls"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ── SCENE 8 INTERACTIVE CONTROLS (JOYSTICK, D-PAD, ZOOM) ────────────────── */}
      {activeScene >= 7 && (
        <>
          {/* Bottom-Left: Virtual Joystick */}
          <div className="absolute bottom-6 left-6 pointer-events-auto hidden sm:block">
            <div
              onMouseDown={onJoystickMouseDown}
              onTouchStart={onJoystickTouchStart}
              className="w-24 h-24 rounded-full glass-panel-dock border border-white/15 relative flex items-center justify-center cursor-grab active:cursor-grabbing shadow-2xl backdrop-blur-xl group"
            >
              {/* Concentric rings */}
              <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-5 rounded-full border border-white/10 pointer-events-none" />

              {/* Movable stick knob */}
              <div
                className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/20 shadow-xl flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                }}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/60 shadow-sm" />
              </div>
            </div>
            <span className="block text-[10px] font-mono text-center text-slate-400 mt-1 uppercase tracking-wider">
              Pan
            </span>
          </div>

          {/* Bottom-Right: Directional D-Pad & Zoom Controls */}
          <div className="absolute bottom-6 right-6 pointer-events-auto flex flex-col items-center gap-3">
            {/* Zoom (+ / -) & Reset Controls */}
            <div className="glass-panel-dock rounded-full p-1.5 flex flex-col gap-1.5 shadow-xl border border-white/15">
              <button
                onClick={() => zoomCamera(0.2)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-200 hover:text-emerald-400 hover:bg-white/10 transition-all active:scale-95"
                title="Zoom In"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => resetCamera()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                title="Reset View"
              >
                1:1
              </button>
              <button
                onClick={() => zoomCamera(-0.2)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-200 hover:text-emerald-400 hover:bg-white/10 transition-all active:scale-95"
                title="Zoom Out"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>

            {/* D-Pad Arrows */}
            <div className="glass-panel-dock rounded-2xl p-2 grid grid-cols-3 gap-1 shadow-xl border border-white/15">
              <div />
              <button
                onClick={() => panCamera(0, 30)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-white/10 active:scale-90"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <div />

              <button
                onClick={() => panCamera(30, 0)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-white/10 active:scale-90"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => resetCamera()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 active:scale-90"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              </button>
              <button
                onClick={() => panCamera(-30, 0)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-white/10 active:scale-90"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div />
              <button
                onClick={() => panCamera(0, -30)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:bg-white/10 active:scale-90"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <div />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
