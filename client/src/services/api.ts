import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'cfm.token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const api = axios.create({ baseURL: `${base}/api`, timeout: 30000 });

api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: { message?: string } }>) => {
    const url = err.config?.url ?? '';
    if (err.response?.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/change-password')) onUnauthorized?.();
    return Promise.reject(err);
  },
);

export interface ApiErrorShape { code: string; message: string; details?: Record<string, unknown> }

export function apiError(err: unknown): ApiErrorShape {
  if (axios.isAxiosError(err)) {
    const e = (err.response?.data as { error?: ApiErrorShape } | undefined)?.error;
    if (e) return e;
    if (err.code === 'ECONNABORTED') return { code: 'TIMEOUT', message: 'The server took too long to respond. Please try again.' };
    if (!err.response) return { code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
}
export const errMsg = (err: unknown) => apiError(err).message;

/** Download a file (PDF/CSV) through the authenticated API. */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await api.get(path, { responseType: 'blob' });
  const cd = res.headers['content-disposition'] as string | undefined;
  const name = /filename="?([^"]+)"?/.exec(cd ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
