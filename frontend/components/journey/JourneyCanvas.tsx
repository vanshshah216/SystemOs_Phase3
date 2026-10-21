"use client";

import React, { useEffect, useRef } from "react";
import Lenis from "lenis";
import { useJourneyStore } from "@/hooks/useJourneyState";
import HUD from "./HUD";
import UnderseaScene from "./UnderseaScene";
import BloomTransition from "./BloomTransition";
import GreenHandScene from "./GreenHandScene";
import CreationScene from "./CreationScene";
import CrimsonShatterScene from "./CrimsonShatterScene";
import CosmicPortalScene from "./CosmicPortalScene";
import CloudRevealScene from "./CloudRevealScene";
import InteractiveCityScene from "./InteractiveCityScene";
import LandmarkModal from "./LandmarkModal";
import BetaModal from "./BetaModal";
import InfoMenuModal from "./InfoMenuModal";
import { sound } from "@/lib/sound";

export default function JourneyCanvas() {
  const {
    scrollProgress,
    setScrollProgress,
    activeScene,
    panCamera,
    zoomCamera,
    toggleMuted
  } = useJourneyStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    lenisRef.current = lenis;

    function onScroll() {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
      setScrollProgress(progress);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Initial sound start attempt on click
    const handleFirstClick = () => {
      sound.playAmbientTrack();
      window.removeEventListener("pointerdown", handleFirstClick);
    };
    window.addEventListener("pointerdown", handleFirstClick);

    return () => {
      lenis.destroy();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", handleFirstClick);
    };
  }, [setScrollProgress]);

  // Keyboard navigation for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "m" || e.key === "M") {
        sound.toggleMute();
        toggleMuted();
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        panCamera(35, 0);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        panCamera(-35, 0);
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        panCamera(0, 35);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        panCamera(0, -35);
      } else if (e.key === "+" || e.key === "=") {
        zoomCamera(0.2);
      } else if (e.key === "-" || e.key === "_") {
        zoomCamera(-0.2);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panCamera, zoomCamera, toggleMuted]);

  return (
    <div ref={containerRef} className="relative w-full bg-black text-white">
      {/* ── FIXED FULL-SCREEN VIEWPORT ────────────────────────────────────────── */}
      <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none select-none">
        {/* Dynamic Scene Layers (Driven by Continuous Scroll Timeline) */}
        <UnderseaScene progress={scrollProgress} />
        <BloomTransition progress={scrollProgress} />
        <GreenHandScene progress={scrollProgress} />
        <CreationScene progress={scrollProgress} />
        <CrimsonShatterScene progress={scrollProgress} />
        <CosmicPortalScene progress={scrollProgress} />
        <CloudRevealScene progress={scrollProgress} />
        <InteractiveCityScene progress={scrollProgress} />

        {/* Global HUD Layer */}
        <HUD />
      </div>

      {/* ── MODALS & OVERLAYS ─────────────────────────────────────────────────── */}
      <LandmarkModal />
      <BetaModal />
      <InfoMenuModal />

      {/* ── SCROLL RUNWAY (850vh FOR SMOOTH 8-SCENE SCRUBBING) ────────────────── */}
      <div className="relative w-full h-[850vh] pointer-events-none" />
    </div>
  );
}
