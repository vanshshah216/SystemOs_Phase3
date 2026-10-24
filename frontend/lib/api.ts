// lib/api.ts – Typed fetch wrappers for SYSTEMOS backend

import type {
  ApplicationsResponse,
  AppSettings,
  CurrentMetricsResponse,
  DiagnosisEvent,
  EventsResponse,
  HealthResponse,
  MetricHistoryResponse,
  ProcessHistoryResponse,
  ProcessListResponse,
  ProcessAnalyzerResponse,
  ProcessRecommendationsResponse,
  SingleProcessAnalysisResponse,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let healthRequest: Promise<HealthResponse> | null = null;
let cachedHealth: HealthResponse | null = null;
let cachedHealthAt = 0;

async function apiFetch<T>(path: string, options?: RequestInit, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  options?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) {
      throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API ${path} timed out after ${timeoutMs / 1000} seconds or was cancelled`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function getHealth(): Promise<HealthResponse> {
  if (cachedHealth && Date.now() - cachedHealthAt < 2000) {
    return Promise.resolve(cachedHealth);
  }
  if (healthRequest) return healthRequest;

  healthRequest = apiFetch<HealthResponse>("/health")
    .then((health) => {
      cachedHealth = health;
      cachedHealthAt = Date.now();
      return health;
    })
    .finally(() => {
      healthRequest = null;
    });
  return healthRequest;
}

// ── Metrics ──────────────────────────────────────────────────────────────────
export const api = {
  getCurrentMetrics: () =>
    apiFetch<CurrentMetricsResponse>("/metrics/current"),

  getMetricHistory: (metric: string, start?: number, end?: number, limit = 500) => {
    const params = new URLSearchParams({ metric, limit: String(limit) });
    if (start) params.set("start", String(start));
    if (end)   params.set("end",   String(end));
    return apiFetch<MetricHistoryResponse>(`/metrics/history?${params}`);
  },

  getMetricStats: (metric: string) =>
    apiFetch<Record<string, unknown>>(`/metrics/stats/${metric}`),

  // ── Processes ──────────────────────────────────────────────────────────────
  getProcesses: (sortBy = "cpu_percent") =>
    apiFetch<ProcessListResponse>(`/processes?sort_by=${sortBy}`),

  getProcessHistory: (pid: number, start?: number, end?: number) => {
    const params = new URLSearchParams({ limit: "200" });
    if (start) params.set("start", String(start));
    if (end)   params.set("end",   String(end));
    return apiFetch<ProcessHistoryResponse>(`/processes/${pid}/history?${params}`);
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
    return apiFetch<ProcessAnalyzerResponse>(
      `/processes/analyzer${qs ? `?${qs}` : ""}`,
      undefined,
      60000,
    );
  },

  getProcessRecommendations: (limit = 20) =>
    apiFetch<ProcessRecommendationsResponse>(
      `/processes/recommendations?limit=${limit}`,
      undefined,
      60000,
    ),

  getProcessCategories: () =>
    apiFetch<Record<string, unknown>>("/processes/categories"),

  getSingleProcessAnalysis: (pid: number) =>
    apiFetch<SingleProcessAnalysisResponse>(`/processes/${pid}/analysis`),

  getApplications: (options?: {
    sortBy?: string;
    limit?: number;
    role?: string;
    search?: string;
    includeSystem?: boolean;
    nocache?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (options?.sortBy) params.set("sort_by", options.sortBy);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.role) params.set("role", options.role);
    if (options?.search) params.set("search", options.search);
    if (options?.includeSystem === false) params.set("include_system", "false");
    if (options?.nocache) params.set("nocache", "true");
    const qs = params.toString();
    return apiFetch<ApplicationsResponse>(`/applications${qs ? `?${qs}` : ""}`);
  },

  triggerCollection: () =>
    apiFetch<{ ok: boolean; timestamp: number; process_count: number }>(
      "/health/collect",
      { method: "POST" },
      60000,
    ),

  // ── Events ─────────────────────────────────────────────────────────────────
  getEvents: (options?: { status?: string; liveOnly?: boolean; includeApplications?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.liveOnly) params.set("live_only", "true");
    if (options?.includeApplications) params.set("include_applications", "true");
    const qs = params.toString();
    return apiFetch<EventsResponse>(`/events${qs ? `?${qs}` : ""}`);
  },

  getEvent: (id: number) =>
    apiFetch<DiagnosisEvent>(`/events/${id}`),

  // ── Health ─────────────────────────────────────────────────────────────────
  getHealth,

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings: () =>
    apiFetch<AppSettings>("/settings"),

  updateSettings: (body: Record<string, unknown>) =>
    apiFetch<{ updated: Record<string, number>; current: AppSettings }>("/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Demo ───────────────────────────────────────────────────────────────────
  getDemoScenarios: () =>
    apiFetch<unknown>("/demo/scenarios"),

  startDemo: (scenario: string) =>
    apiFetch<unknown>("/demo/start", { method: "POST", body: JSON.stringify({ scenario }) }),

  stopDemo: () =>
    apiFetch<unknown>("/demo/stop", { method: "POST" }),

  getDemoStatus: () =>
    apiFetch<unknown>("/demo/status"),
};
