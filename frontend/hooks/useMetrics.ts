"use client";
import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { SystemMetric, HistoryPoint, MetricKey } from "@/types";
import { usePolling } from "@/hooks/usePolling";

// ── Current metrics polled every 3s ──────────────────────────────────────────
export function useCurrentMetrics(intervalMs = 3000) {
  const [data, setData]     = useState<SystemMetric | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getCurrentMetrics();
      if (res.status === "no_data") {
        setData(null);
        setError("Waiting for the first telemetry sample from the backend.");
        return;
      }
      const maxAgeSeconds = Math.max(60, intervalMs / 1000 * 5);
      if ((res.collector_age_seconds ?? 0) > maxAgeSeconds) {
        setData(null);
        setError("Telemetry is stale. Check that the backend collector is running.");
        return;
      }
      setData(res);
      setError(null);
    } catch (error: unknown) {
      setData(null);
      setError(error instanceof Error ? error.message : "Metrics API unavailable");
    } finally {
      setLoading(false);
    }
  }, [intervalMs]);
  const refresh = usePolling(fetchData, intervalMs);

  return { data, error, loading, refresh };
}

// ── Metric history for charts ─────────────────────────────────────────────────
export function useMetricHistory(
  metric: MetricKey,
  rangeSeconds: number = 3600,
  pollMs: number = 5000,
) {
  const [data, setData]   = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchData = useCallback(async () => {
    try {
      const now   = Date.now() / 1000;
      const start = now - rangeSeconds;
      const res   = await api.getMetricHistory(metric, start, now);
      setData(res.data ?? []);
      setError(null);
    } catch (error) {
      setData([]);
      setError(error instanceof Error ? error.message : `${metric} history API unavailable`);
      console.error(`Failed to load ${metric} history`, error);
    } finally {
      setLoading(false);
    }
  }, [metric, rangeSeconds]);
  usePolling(fetchData, pollMs);

  return { data, loading, error };
}

// ── Health status polled every 5s ─────────────────────────────────────────────
export function useHealth(pollMs = 5000) {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof api.getHealth>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setHealth(await api.getHealth());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Health API unavailable");
    }
  }, []);
  usePolling(fetchHealth, pollMs);

  return { health, error };
}
