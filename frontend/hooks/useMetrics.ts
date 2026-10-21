"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { SystemMetric, HistoryPoint, MetricKey } from "@/types";

// ── Current metrics polled every 3s ──────────────────────────────────────────
export function useCurrentMetrics(intervalMs = 3000) {
  const [data, setData]     = useState<SystemMetric | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getCurrentMetrics();
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { data, error, loading, refresh: fetchData };
}

// ── Metric history for charts ─────────────────────────────────────────────────
export function useMetricHistory(
  metric: MetricKey,
  rangeSeconds: number = 3600,
  pollMs: number = 5000,
) {
  const [data, setData]   = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const rangeRef = useRef(rangeSeconds);
  rangeRef.current = rangeSeconds;

  const fetchData = useCallback(async () => {
    try {
      const now   = Date.now() / 1000;
      const start = now - rangeRef.current;
      const res   = await api.getMetricHistory(metric, start, now);
      setData(res.data ?? []);
    } catch (_) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [metric]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, pollMs);
    return () => clearInterval(id);
  }, [fetchData, pollMs]);

  return { data, loading };
}

// ── Health status polled every 5s ─────────────────────────────────────────────
export function useHealth(pollMs = 5000) {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try { setHealth(await api.getHealth()); } catch (_) {}
    };
    fetch_();
    const id = setInterval(fetch_, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return health;
}
