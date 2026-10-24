"use client";
import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { ProcessHistoryPoint, ProcessInfo, ProcessRecommendation, ProcessAnalyzerResponse } from "@/types";
import { usePolling } from "@/hooks/usePolling";

export function useProcesses(sortBy = "cpu_percent", pollMs = 4000) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getProcesses(sortBy);
      setProcesses(res.processes ?? []);
      setError(null);
    } catch (error: unknown) {
      setProcesses([]);
      setError(error instanceof Error ? error.message : "Processes API unavailable");
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  const refresh = usePolling(fetchData, pollMs);

  return { processes, loading, error, refresh };
}

export function useProcessHistory(pid: number | null, rangeSeconds = 3600) {
  const [history, setHistory] = useState<ProcessHistoryPoint[]>([]);
  const [loading, setLoading] = useState(Boolean(pid));
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!pid) return;
    const now   = Date.now() / 1000;
    const start = now - rangeSeconds;
    setLoading(true);
    try {
      const response = await api.getProcessHistory(pid, start, now);
      setHistory(response.history ?? []);
      setError(null);
    } catch (failure: unknown) {
      setHistory([]);
      setError(failure instanceof Error ? failure.message : "Process history API unavailable");
    } finally {
      setLoading(false);
    }
  }, [pid, rangeSeconds]);
  usePolling(fetchData, 5000, Boolean(pid));

  return { history, loading, error };
}

export function useProcessAnalyzer(options?: {
  sortBy?: string;
  limit?: number;
  category?: string;
  safety?: string;
  search?: string;
  pollMs?: number;
}) {
  const [data, setData] = useState<ProcessAnalyzerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollMs = options?.pollMs ?? 4000;
  const sortBy = options?.sortBy;
  const limit = options?.limit;
  const category = options?.category;
  const safety = options?.safety;
  const search = options?.search;

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getProcessAnalyzer({
        sortBy,
        limit,
        category,
        safety,
        search,
      });
      setData(res);
      setError(null);
    } catch (failure: unknown) {
      setData(null);
      setError(failure instanceof Error ? failure.message : "Process analyzer telemetry unavailable");
    } finally {
      setLoading(false);
    }
  }, [sortBy, limit, category, safety, search]);

  const refresh = usePolling(fetchData, pollMs);

  return { data, loading, error, refresh };
}

export function useProcessRecommendations(limit = 20, pollMs = 5000) {
  const [recommendations, setRecommendations] = useState<ProcessRecommendation[]>([]);
  const [potentialReclaimableMb, setPotentialReclaimableMb] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getProcessRecommendations(limit);
      setRecommendations(res.recommendations ?? []);
      setPotentialReclaimableMb(res.potential_reclaimable_memory_mb ?? 0);
      setError(null);
    } catch (err: unknown) {
      setRecommendations([]);
      setPotentialReclaimableMb(0);
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const refresh = usePolling(fetchData, pollMs);

  return { recommendations, potentialReclaimableMb, loading, error, refresh };
}
