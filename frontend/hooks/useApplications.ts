"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { ApplicationsResponse } from "@/types";
import { usePolling } from "@/hooks/usePolling";

export function useApplications(options?: {
  sortBy?: string;
  limit?: number;
  role?: string;
  search?: string;
  includeSystem?: boolean;
  pollMs?: number;
}) {
  const [data, setData] = useState<ApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollMs = options?.pollMs ?? 4000;
  const sortBy = options?.sortBy;
  const limit = options?.limit;
  const role = options?.role;
  const search = options?.search;
  const includeSystem = options?.includeSystem;

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getApplications({
        sortBy,
        limit,
        role,
        search,
        includeSystem,
      });
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setData(null);
      const msg = err instanceof Error ? err.message : "Applications API unavailable";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sortBy, limit, role, search, includeSystem]);
  const refresh = usePolling(fetchData, pollMs);

  return { data, loading, error, refresh };
}
