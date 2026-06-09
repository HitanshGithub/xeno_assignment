'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

interface UseApiOptions {
  /** Poll interval in ms. Omit for a single fetch. */
  pollMs?: number;
  enabled?: boolean;
}

/**
 * Minimal data hook: GETs a path, exposes { data, error, loading, refetch },
 * and optionally polls — used by the live campaign view to watch the funnel
 * fill as receipts arrive.
 */
export function useApi<T>(path: string | null, opts: UseApiOptions = {}) {
  const { pollMs, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const active = useRef(true);

  const refetch = useCallback(async () => {
    if (!path) return;
    try {
      const result = await api.get<T>(path);
      if (active.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (active.current) setError(e as Error);
    } finally {
      if (active.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    active.current = true;
    if (!enabled || !path) return;
    void refetch();
    if (pollMs) {
      const id = setInterval(refetch, pollMs);
      return () => {
        active.current = false;
        clearInterval(id);
      };
    }
    return () => {
      active.current = false;
    };
  }, [refetch, pollMs, enabled, path]);

  return { data, error, loading, refetch, setData };
}
