"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useJourneyStore } from "@/hooks/useJourneyState";
import { sound } from "@/lib/sound";
import { Sparkles } from "lucide-react";

interface Point {
  x: number;
  y: number;
  time: number;
}

export default function UnderseaScene({ progress }: { progress: number }) {
  const { hasDrawnZero, setHasDrawnZero, jumpToScene } = useJourneyStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showStarExplosion, setShowStarExplosion] = useState(false);

  // Opacity of scene 1: fades out between progress 0.10 and 0.18
  const sceneOpacity = Math.max(0, Math.min(1, (0.16 - progress) / 0.1));

  // If user scrolls past 0.05, auto-trigger completion if not done
  useEffect(() => {
    if (progress > 0.06 && !hasDrawnZero) {
      setHasDrawnZero(true);
      sound.playSparkle();
    }
  }, [progress, hasDrawnZero, setHasDrawnZero]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    sound.playAmbientTrack();
    const rect = e.currentTarget.getBoundingClientRect();
    setTrail([{ x: e.clientX - rect.left, y: e.clientY - rect.top, time: Date.now() }]);
  };

  const completeDrawing = useCallback(() => {
    if (hasDrawnZero) return;
    setHasDrawnZero(true);
    setShowStarExplosion(true);
    sound.playSparkle();
    sound.playWhoosh();
    setTimeout(() => {
      jumpToScene(2); // advance to scene 2 / 3
    }, 1200);
  }, [hasDrawnZero, setHasDrawnZero, jumpToScene]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing && trail.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const newPt = { x: e.clientX - rect.left, y: e.clientY - rect.top, time: Date.now() };

    setTrail((prev) => {
      const updated = [...prev, newPt].slice(-50);
      // Check if user has drawn a circular motion (points covered at least 30 steps)
      if (updated.length > 25 && !hasDrawnZero) {
        completeDrawing();
      }
      return updated;
    });
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    if (trail.length > 15 && !hasDrawnZero) {
      completeDrawing();
    }
  };

  // Render glowing white bead trail on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (trail.length > 1) {
        for (let i = 0; i < trail.length; i++) {
          const pt = trail[i];
          const radius = Math.min(22, 10 + i * 0.35);
          const alpha = Math.min(1, i / trail.length);

          // Outer green glow
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha * 0.4})`;
          ctx.fill();

          // Core bright white bead
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.shadowColor = "#34d399";
          ctx.shadowBlur = 18;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [trail]);

  // Resize canvas to match window
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  if (sceneOpacity <= 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
      style={{ opacity: sceneOpacity }}
    >
      {/* Background Undersea Caustics Texture */}
      <div
        className="absolute inset-0 bg-cover bg-center mix-blend-screen scale-105 transition-transform duration-1000"
        style={{
          backgroundImage: "url('/textures/clean_underwater.png')",
          filter: `brightness(${1 + progress * 2}) saturate(1.2)`,
          transform: `scale(${1.05 + progress * 0.3}) translateY(${progress * -30}px)`
        }}
      />

      {/* Floating Bioluminescent Cyan / Emerald Particle Dust */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-emerald-300/40 blur-[1px] animate-float"
            style={{
              width: `${(i % 5) + 3}px`,
              height: `${(i % 5) + 3}px`,
              top: `${(i * 19) % 95}%`,
              left: `${(i * 23) % 95}%`,
              animationDuration: `${4 + (i % 6)}s`,
              animationDelay: `${(i * 0.3)}s`,
            }}
          />
        ))}
      </div>

      {/* Interactive Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="absolute inset-0 pointer-events-auto cursor-crosshair z-20"
      />

      {/* "DRAW A ZERO" Prompt */}
      {!hasDrawnZero && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none">
          <div className="flex flex-col items-center animate-pulse-slow">
            {/* Guide circle indicator */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-dashed border-white/40 flex items-center justify-center relative mb-4">
              <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_20px_#ffffff] absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
              <span className="font-mono text-sm sm:text-base tracking-[0.25em] text-white/90 font-medium">
                DRAW A ZERO
              </span>
            </div>
            <p className="text-xs font-mono text-emerald-300/80 tracking-widest uppercase">
              Trace circle or scroll down to begin
            </p>
          </div>
        </div>
      )}

      {/* Golden Star Sparkle Explosion (+100 XP) */}
      {showStarExplosion && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 animate-in zoom-in-50 fade-in duration-500">
          <div className="relative flex flex-col items-center">
            {/* Golden 4-point star SVG */}
            <svg
              className="w-24 h-24 text-amber-300 glow-star animate-spin-slow"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
            <span className="font-mono text-2xl font-bold text-amber-300 tracking-widest mt-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]">
              + 100 XP
            </span>
            <span className="text-xs font-mono text-slate-300 tracking-wider mt-1 uppercase">
              Consciousness Activated
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
