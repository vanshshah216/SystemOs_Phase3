"use client";

import React from "react";

export default function CrimsonShatterScene({ progress }: { progress: number }) {
  const start = 0.50;
  const end = 0.68;

  if (progress < start || progress > end) return null;

  const localP = (progress - start) / (end - start);
  const opacity = Math.sin(localP * Math.PI);

  // Shatter effect at the beginning (0.0 to 0.25 of this scene)
  const shatterProgress = Math.min(1, localP * 3.5);
  const shatterOpacity = Math.max(0, 1 - localP * 3);

  // Camera tracking up the red beam
  const translateY = (localP - 0.5) * -40;
  const scale = 0.98 + localP * 0.25;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200 overflow-hidden flex items-center justify-center select-none"
      style={{ opacity }}
    >
      {/* Background Dark Crimson Void with Volumetric Light Beam */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
        style={{
          backgroundImage: "url('/textures/clean_red_hand.png')",
          transform: `scale(${scale}) translateY(${translateY}px)`,
          filter: "contrast(1.15) brightness(1.05)",
        }}
      />

      {/* Explosive Shatter Shard Overlay at entrance */}
      {shatterOpacity > 0.05 && (
        <div
          className="absolute inset-0 bg-cover bg-center mix-blend-screen pointer-events-none transition-transform"
          style={{
            backgroundImage: "url('/textures/clean_red_break.png')",
            opacity: shatterOpacity,
            transform: `scale(${1 + shatterProgress * 0.4})`,
            filter: "hue-rotate(-10deg) brightness(1.3)",
          }}
        />
      )}

      {/* Floating 3D Polygonal Crystal Prisms / Rainbow Triangular Shards */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { top: "20%", left: "15%", size: "70px", rot: "15deg", speed: 0.8 },
          { top: "35%", left: "75%", size: "90px", rot: "-25deg", speed: 1.3 },
          { top: "65%", left: "20%", size: "85px", rot: "45deg", speed: 1.1 },
          { top: "75%", left: "80%", size: "65px", rot: "-35deg", speed: 0.9 },
          { top: "15%", left: "70%", size: "60px", rot: "55deg", speed: 1.4 },
        ].map((prism, i) => (
          <div
            key={i}
            className="absolute transition-transform duration-200"
            style={{
              top: prism.top,
              left: prism.left,
              width: prism.size,
              height: prism.size,
              transform: `translate(${(localP - 0.5) * prism.speed * 60}px, ${(localP - 0.5) * prism.speed * -45}px) rotate(${parseFloat(prism.rot) + localP * 50}deg)`,
            }}
          >
            {/* Triangular Glass Prism SVG */}
            <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              <polygon
                points="50,15 90,85 10,85"
                fill="rgba(255, 255, 255, 0.08)"
                stroke="rgba(255, 120, 120, 0.45)"
                strokeWidth="1.5"
              />
              {/* Iridescent edge reflection */}
              <polygon
                points="50,15 90,85 50,55"
                fill="url(#rainbow-grad)"
                opacity="0.3"
              />
              <defs>
                <linearGradient id="rainbow-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff4500" />
                  <stop offset="50%" stopColor="#ff007f" />
                  <stop offset="100%" stopColor="#00f2fe" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        ))}
      </div>

      {/* Atmospheric Crimson Ember Dust */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-red-400/50 blur-[1px] animate-float"
            style={{
              width: `${(i % 4) + 2}px`,
              height: `${(i % 4) + 2}px`,
              top: `${(i * 17) % 95}%`,
              left: `${(i * 23) % 95}%`,
              animationDuration: `${3 + (i % 4)}s`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
