import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '@/services/api';
import type { PageMeta } from '@/types';

/**
 * Minimal GET hook: refetches when path/params change, exposes reload().
 * Keeps previous data while reloading to avoid layout flashes.
 */
export function useApi<T>(path: string | null, params?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const key = JSON.stringify(params ?? {});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(JSON.parse(key) as Record<string, unknown>).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== 'all'));
      const res = await api.get(path, { params: clean });
      if (id !== reqId.current) return;
      setData(res.data.data);
      setMeta(res.data.meta ?? null);
      setError(null);
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [path, key]);

  useEffect(() => { void load(); }, [load]);
  return { data, meta, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mql = window.matchMedia(q);
    const h = () => setM(mql.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, [q]);
  return m;
}
