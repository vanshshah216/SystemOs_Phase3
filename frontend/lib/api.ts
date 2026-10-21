// lib/api.ts – Typed fetch wrappers for SYSTEMOS backend

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Metrics ──────────────────────────────────────────────────────────────────
export const api = {
  getCurrentMetrics: () =>
    apiFetch<any>("/metrics/current"),

  getMetricHistory: (metric: string, start?: number, end?: number, limit = 500) => {
    const params = new URLSearchParams({ metric, limit: String(limit) });
    if (start) params.set("start", String(start));
    if (end)   params.set("end",   String(end));
    return apiFetch<any>(`/metrics/history?${params}`);
  },

  getMetricStats: (metric: string) =>
    apiFetch<any>(`/metrics/stats/${metric}`),

  // ── Processes ──────────────────────────────────────────────────────────────
  getProcesses: (sortBy = "cpu_percent") =>
    apiFetch<any>(`/processes?sort_by=${sortBy}`),

  getProcessHistory: (pid: number, start?: number, end?: number) => {
    const params = new URLSearchParams({ limit: "200" });
    if (start) params.set("start", String(start));
    if (end)   params.set("end",   String(end));
    return apiFetch<any>(`/processes/${pid}/history?${params}`);
  },

  getProcessAnalyzer: (options?: {
    sortBy?: string;
    limit?: number;
    category?: string;
    safety?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.sortBy) params.set("sort_by", options.sortBy);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.category) params.set("category", options.category);
    if (options?.safety) params.set("safety", options.safety);
    if (options?.search) params.set("search", options.search);
    const qs = params.toString();
    return apiFetch<any>(`/processes/analyzer${qs ? `?${qs}` : ""}`);
  },

  getProcessRecommendations: (limit = 20) =>
    apiFetch<any>(`/processes/recommendations?limit=${limit}`),

  getProcessCategories: () =>
    apiFetch<any>("/processes/categories"),

  getSingleProcessAnalysis: (pid: number) =>
    apiFetch<any>(`/processes/${pid}/analysis`),

  // ── Events ─────────────────────────────────────────────────────────────────
  getEvents: (status?: string) => {
    const params = status ? `?status=${status}` : "";
    return apiFetch<any>(`/events${params}`);
  },

  getEvent: (id: number) =>
    apiFetch<any>(`/events/${id}`),

  // ── Health ─────────────────────────────────────────────────────────────────
  getHealth: () =>
    apiFetch<any>("/health"),

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings: () =>
    apiFetch<any>("/settings"),

  updateSettings: (body: Record<string, unknown>) =>
    apiFetch<any>("/settings", { method: "POST", body: JSON.stringify(body) }),

  // ── Demo ───────────────────────────────────────────────────────────────────
  getDemoScenarios: () =>
    apiFetch<any>("/demo/scenarios"),

  startDemo: (scenario: string) =>
    apiFetch<any>("/demo/start", { method: "POST", body: JSON.stringify({ scenario }) }),

  stopDemo: () =>
    apiFetch<any>("/demo/stop", { method: "POST" }),

  getDemoStatus: () =>
    apiFetch<any>("/demo/status"),
};
