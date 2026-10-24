"use client";
import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { DiagnosisEvent } from "@/types";
import { usePolling } from "@/hooks/usePolling";

export function useEvents(pollMs = 5000, liveOnly = true, includeApplications = false) {
  const [events, setEvents]   = useState<DiagnosisEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getEvents({ liveOnly, includeApplications });
      setEvents(res.events ?? []);
      setError(null);
    } catch (err: unknown) {
      setEvents([]);
      setError(err instanceof Error ? err.message : "Events API unavailable");
    } finally {
      setLoading(false);
    }
  }, [liveOnly, includeApplications]);
  const refresh = usePolling(fetchData, pollMs);

  return { events, loading, error, refresh };
}

export function useEvent(id: number | null) {
  const [event, setEvent]   = useState<DiagnosisEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setEvent(await api.getEvent(id));
      setError(null);
    } catch (err: unknown) {
      setEvent(null);
      setError(err instanceof Error ? err.message : "Event API unavailable");
    } finally {
      setLoading(false);
    }
  }, [id]);
  usePolling(fetchEvent, 3000, id != null);

  return { event, loading, error };
}
