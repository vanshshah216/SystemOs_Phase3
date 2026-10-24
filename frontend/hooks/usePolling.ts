"use client";

import { useCallback, useEffect } from "react";

export const MONITOR_REFRESH_EVENT = "systemos:refresh";

export function requestMonitorRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MONITOR_REFRESH_EVENT));
  }
}

export function usePolling(task: () => Promise<void>, intervalMs: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let inFlight = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (!active) return;
      if (inFlight) {
        pending = true;
        return;
      }
      inFlight = true;
      try {
        await task();
      } catch (error) {
        console.error("Monitoring poll failed", error);
      } finally {
        inFlight = false;
        if (active) {
          timer = setTimeout(run, pending ? 0 : intervalMs);
          pending = false;
        }
      }
    };

    const refresh = () => {
      if (inFlight) {
        pending = true;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 0);
    };

    window.addEventListener(MONITOR_REFRESH_EVENT, refresh);
    void run();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener(MONITOR_REFRESH_EVENT, refresh);
    };
  }, [task, intervalMs, enabled]);

  return useCallback(() => requestMonitorRefresh(), []);
}
