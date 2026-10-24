"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { AppSettings } from "@/types";
import { requestMonitorRefresh, usePolling } from "@/hooks/usePolling";

const DEFAULT_INTERVAL_MS = 3000;

/**
 * Loads backend sampling_interval and exposes a shared poll interval + manual refresh trigger.
 */
export function usePollingSettings() {
  const [pollMs, setPollMs] = useState(DEFAULT_INTERVAL_MS);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const inflight = useRef(false);

  const loadSettings = useCallback(async () => {
    try {
      const nextSettings = await api.getSettings();
      setSettings(nextSettings);
      const seconds = Number.parseFloat(nextSettings.sampling_interval);
      if (!Number.isNaN(seconds) && seconds >= 1) {
        setPollMs(Math.round(seconds * 1000));
      }
      setBackendOffline(false);
    } catch (error: unknown) {
      setBackendOffline(true);
      setRefreshError(error instanceof Error ? error.message : "Settings API unavailable");
    }
  }, []);
  usePolling(loadSettings, 10000);

  const refreshAll = useCallback(async () => {
    if (inflight.current) return null;
    inflight.current = true;
    try {
      const result = await api.triggerCollection();
      setLastRefresh(result.timestamp ?? Date.now() / 1000);
      setBackendOffline(false);
      setRefreshError(null);
      requestMonitorRefresh();
      return result;
    } catch (error: unknown) {
      setBackendOffline(true);
      setRefreshError(error instanceof Error ? error.message : "Telemetry refresh failed");
      return null;
    } finally {
      inflight.current = false;
    }
  }, []);

  return {
    pollMs,
    settings,
    backendOffline,
    setBackendOffline,
    lastRefresh,
    refreshError,
    refreshAll,
    inflight,
  };
}
