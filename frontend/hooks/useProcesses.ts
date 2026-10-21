"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ProcessInfo, ProcessProfile, ProcessRecommendation, ProcessAnalyzerResponse } from "@/types";

export function useProcesses(sortBy = "cpu_percent", pollMs = 4000) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading]     = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getProcesses(sortBy);
      setProcesses(res.processes ?? []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [sortBy]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, pollMs);
    return () => clearInterval(id);
  }, [fetchData, pollMs]);

  return { processes, loading, refresh: fetchData };
}

export function useProcessHistory(pid: number | null, rangeSeconds = 3600) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    const now   = Date.now() / 1000;
    const start = now - rangeSeconds;
    api.getProcessHistory(pid, start, now)
      .then(r => setHistory(r.history ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid, rangeSeconds]);

  return { history, loading };
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

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getProcessAnalyzer({
        sortBy: options?.sortBy,
        limit: options?.limit,
        category: options?.category,
        safety: options?.safety,
        search: options?.search,
      });
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Process analyzer telemetry unavailable");
    } finally {
      setLoading(false);
    }
  }, [options?.sortBy, options?.limit, options?.category, options?.safety, options?.search]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, pollMs);
    return () => clearInterval(id);
  }, [fetchData, pollMs]);

  return { data, loading, error, refresh: fetchData };
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
    } catch (err: any) {
      setError(err?.message || "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, pollMs);
    return () => clearInterval(id);
  }, [fetchData, pollMs]);

  return { recommendations, potentialReclaimableMb, loading, error, refresh: fetchData };
}

