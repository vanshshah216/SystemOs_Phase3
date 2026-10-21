"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { DiagnosisEvent } from "@/types";

export function useEvents(pollMs = 5000) {
  const [events, setEvents]   = useState<DiagnosisEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getEvents();
      setEvents(res.events ?? []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, pollMs);
    return () => clearInterval(id);
  }, [fetchData, pollMs]);

  return { events, loading, refresh: fetchData };
}

export function useEvent(id: number | null) {
  const [event, setEvent]   = useState<DiagnosisEvent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getEvent(id)
      .then(setEvent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { event, loading };
}
