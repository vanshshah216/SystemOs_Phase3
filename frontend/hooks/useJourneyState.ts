"use client";

import { create } from "zustand";

export interface Landmark {
  id: string;
  name: string;
  category: string;
  description: string;
  techStack: string[];
  x: number; // percentage on map (0 - 100)
  y: number; // percentage on map (0 - 100)
  color: string;
  stats: { label: string; value: string }[];
}

export const LANDMARKS: Landmark[] = [
  {
    id: "apple",
    name: "Apple Infinite Loop & Park",
    category: "Hardware & Operating Systems",
    description: "The monolithic circular campus. Home to silicon architecture, neuro-engine design, and ecosystem operating systems.",
    techStack: ["M4 Ultra", "Metal", "Swift", "CoreML"],
    x: 57.5,
    y: 33.0,
    color: "#10b981",
    stats: [
      { label: "Active Cores", value: "192K" },
      { label: "Bandwidth", value: "800 GB/s" },
      { label: "Security Level", value: "Class 0" }
    ]
  },
  {
    id: "openai",
    name: "OpenAI Research Tower",
    category: "Frontier Foundation Models",
    description: "Autonomous reasoning agents and synthetic intelligence synthesis lab. High-density compute cluster node.",
    techStack: ["GPT-5", "Triton", "PyTorch", "vLLM"],
    x: 40.0,
    y: 62.0,
    color: "#06b6d4",
    stats: [
      { label: "Tokens/sec", value: "48.2M" },
      { label: "Context Window", value: "2M tokens" },
      { label: "Reasoning Depth", value: "99.4%" }
    ]
  },
  {
    id: "netflix",
    name: "Netflix Real-time CDN Tower",
    category: "Edge Streaming & Transcoding",
    description: "Global low-latency content distribution and dynamic predictive caching across distributed planetary nodes.",
    techStack: ["Chaos Engineering", "gRPC", "Kafka", "Rust"],
    x: 62.8,
    y: 35.5,
    color: "#ef4444",
    stats: [
      { label: "Global Streams", value: "310M" },
      { label: "Edge Latency", value: "< 8ms" },
      { label: "Uptime", value: "99.999%" }
    ]
  },
  {
    id: "meta",
    name: "Meta Reality Labs & Infinity Hub",
    category: "Spatial Computing & Open Source AI",
    description: "Open-weights intelligence cluster and spatial computing neural interface research center.",
    techStack: ["Llama 4", "PyTorch", "React", "WebXR"],
    x: 70.0,
    y: 34.0,
    color: "#3b82f6",
    stats: [
      { label: "Open Weights", value: "405B" },
      { label: "Cluster Nodes", value: "32,000" },
      { label: "Ecosystem Size", value: "3.2B users" }
    ]
  },
  {
    id: "stripe",
    name: "Stripe Sovereign Ledger",
    category: "Programmable Global Finance",
    description: "Ultra high-reliability monetary infrastructure running distributed fault-tolerant transactional consensus.",
    techStack: ["Ruby", "Sorbet", "Kafka", "Postgres"],
    x: 67.5,
    y: 72.0,
    color: "#6366f1",
    stats: [
      { label: "Throughput", value: "100k req/s" },
      { label: "Ledger Drift", value: "$0.00" },
      { label: "Availability", value: "99.9999%" }
    ]
  },
  {
    id: "nvidia",
    name: "Nvidia Tensor Matrix Dome",
    category: "Accelerated Silicon & Interconnects",
    description: "Blackwell NVLink cluster facility delivering exaflops of sovereign accelerated compute.",
    techStack: ["CUDA", "TensorRT", "NVLink 5", "CuDNN"],
    x: 66.8,
    y: 45.0,
    color: "#22c55e",
    stats: [
      { label: "Compute Density", value: "20 Exaflops" },
      { label: "TDP Efficiency", value: "25x" },
      { label: "Interconnect", value: "1.8 TB/s" }
    ]
  },
  {
    id: "amazon",
    name: "Amazon Hyper-Scale Eco-Dome",
    category: "Planetary Cloud Infrastructure",
    description: "Multi-region redundant cloud cluster with integrated bio-domes and autonomous logistics routing.",
    techStack: ["Firecracker", "DynamoDB", "Nitro", "Rust"],
    x: 38.5,
    y: 42.0,
    color: "#f59e0b",
    stats: [
      { label: "Global Regions", value: "34" },
      { label: "MicroVM Boot", value: "5ms" },
      { label: "Capacity", value: "Exabyte" }
    ]
  },
  {
    id: "spacex",
    name: "SpaceX Starship Orbital Complex",
    category: "Orbital Launch & Starlink Grid",
    description: "Launch pad and deep-space telemetry ground station communicating with low-earth orbit satellite constellation.",
    techStack: ["C++", "LabVIEW", "Real-Time Linux", "Starlink"],
    x: 74.0,
    y: 56.0,
    color: "#e2e8f0",
    stats: [
      { label: "Payload to Orbit", value: "150 Tons" },
      { label: "Launch Cadence", value: "3.5 Days" },
      { label: "Constellation", value: "6,500 Sats" }
    ]
  },
  {
    id: "waitlist_dome",
    name: "Zero Core Hologram & Arena",
    category: "Central University Hub",
    description: "The nerve center of Zero University. Connects all sovereign learners to real-world engineering environments.",
    techStack: ["ZeroOS", "Neural Kernel", "Sovereign AI", "Web3"],
    x: 49.5,
    y: 51.5,
    color: "#34d399",
    stats: [
      { label: "Waitlist Tier", value: "VIP Genesis" },
      { label: "Network Effect", value: "+100 XP" },
      { label: "Acceptance Rate", value: "Top 2%" }
    ]
  }
];

export interface JourneyStore {
  scrollProgress: number;
  activeScene: number;
  xp: number;
  depthBZ: number;
  hasDrawnZero: boolean;
  holdProgress: number;
  isHolding: boolean;
  selectedLandmark: Landmark | null;
  cameraPos: { x: number; y: number; zoom: number };
  isMuted: boolean;
  betaModalOpen: boolean;
  infoMenuOpen: boolean;

  setScrollProgress: (progress: number) => void;
  setHasDrawnZero: (drawn: boolean) => void;
  setHoldProgress: (progress: number) => void;
  setIsHolding: (holding: boolean) => void;
  setSelectedLandmark: (landmark: Landmark | null) => void;
  setCameraPos: (pos: { x: number; y: number; zoom: number }) => void;
  panCamera: (dx: number, dy: number) => void;
  zoomCamera: (delta: number) => void;
  resetCamera: () => void;
  toggleMuted: () => void;
  setBetaModalOpen: (open: boolean) => void;
  setInfoMenuOpen: (open: boolean) => void;
  jumpToScene: (sceneNum: number) => void;
}

// Compute active scene from scroll progress (0 to 1)
function getSceneFromProgress(p: number): { scene: number; xp: number; bz: number } {
  if (p < 0.12) {
    return { scene: 1, xp: 0, bz: -188 };
  } else if (p < 0.19) {
    const factor = (p - 0.12) / 0.07;
    return { scene: 2, xp: Math.round(100 * factor), bz: Math.round(-188 + 20 * factor) };
  } else if (p < 0.35) {
    const factor = (p - 0.19) / 0.16;
    return { scene: 3, xp: 100, bz: Math.round(-188 + 113 * factor) }; // -188 to -75
  } else if (p < 0.51) {
    const factor = (p - 0.35) / 0.16;
    return { scene: 4, xp: Math.round(100 + 99 * factor), bz: Math.round(-75 + 25 * factor) }; // -75 to -50
  } else if (p < 0.67) {
    const factor = (p - 0.51) / 0.16;
    return { scene: 5, xp: Math.round(199 + 101 * factor), bz: Math.round(-50 + 25 * factor) }; // -50 to -25
  } else if (p < 0.81) {
    const factor = (p - 0.67) / 0.14;
    return { scene: 6, xp: Math.round(300 + 100 * factor), bz: Math.round(-25 * (1 - factor)) }; // -25 to 0
  } else if (p < 0.91) {
    const factor = (p - 0.81) / 0.10;
    return { scene: 7, xp: Math.round(400 + 100 * factor), bz: 0 };
  } else {
    return { scene: 8, xp: 500, bz: 0 };
  }
}

export const useJourneyStore = create<JourneyStore>((set, get) => ({
  scrollProgress: 0,
  activeScene: 1,
  xp: 0,
  depthBZ: -188,
  hasDrawnZero: false,
  holdProgress: 0,
  isHolding: false,
  selectedLandmark: null,
  cameraPos: { x: 0, y: 0, zoom: 1 },
  isMuted: false,
  betaModalOpen: false,
  infoMenuOpen: false,

  setScrollProgress: (progress: number) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const { scene, xp, bz } = getSceneFromProgress(clamped);
    set({
      scrollProgress: clamped,
      activeScene: scene,
      xp: get().hasDrawnZero ? Math.max(100, xp) : xp,
      depthBZ: bz,
    });
  },

  setHasDrawnZero: (drawn: boolean) => {
    set((state) => ({
      hasDrawnZero: drawn,
      xp: drawn ? Math.max(100, state.xp) : state.xp,
    }));
  },

  setHoldProgress: (progress: number) => {
    set({ holdProgress: Math.max(0, Math.min(1, progress)) });
  },

  setIsHolding: (holding: boolean) => {
    set({ isHolding: holding });
  },

  setSelectedLandmark: (landmark: Landmark | null) => {
    set({ selectedLandmark: landmark });
    if (landmark) {
      // Smoothly offset camera to focus landmark
      const targetX = (landmark.x - 50) * -1.8;
      const targetY = (landmark.y - 50) * -1.8;
      set({ cameraPos: { x: targetX, y: targetY, zoom: 1.4 } });
    }
  },

  setCameraPos: (pos) => set({ cameraPos: pos }),

  panCamera: (dx: number, dy: number) => {
    set((state) => ({
      cameraPos: {
        ...state.cameraPos,
        x: Math.max(-150, Math.min(150, state.cameraPos.x + dx)),
        y: Math.max(-120, Math.min(120, state.cameraPos.y + dy)),
      },
    }));
  },

  zoomCamera: (delta: number) => {
    set((state) => ({
      cameraPos: {
        ...state.cameraPos,
        zoom: Math.max(0.7, Math.min(2.5, state.cameraPos.zoom + delta)),
      },
    }));
  },

  resetCamera: () => {
    set({ cameraPos: { x: 0, y: 0, zoom: 1 }, selectedLandmark: null });
  },

  toggleMuted: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  setBetaModalOpen: (open: boolean) => set({ betaModalOpen: open }),
  setInfoMenuOpen: (open: boolean) => set({ infoMenuOpen: open }),

  jumpToScene: (sceneNum: number) => {
    const sceneScrollPoints = [0, 0.05, 0.16, 0.30, 0.45, 0.58, 0.72, 0.82, 0.95];
    const targetProgress = sceneScrollPoints[sceneNum] ?? 0;
    if (typeof window !== "undefined") {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: targetProgress * maxScroll,
        behavior: "smooth",
      });
    }
    get().setScrollProgress(targetProgress);
  },
}));
