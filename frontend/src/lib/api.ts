import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Fetch wrapper: attaches the Supabase access token and surfaces API errors.
 * A request that takes >3s flips `coldStart` so the UI can explain Render's
 * free-tier wake-up delay.
 */
export let coldStartListeners: ((waking: boolean) => void)[] = [];
export const onColdStart = (fn: (waking: boolean) => void) => {
  coldStartListeners.push(fn);
  return () => {
    coldStartListeners = coldStartListeners.filter((f) => f !== fn);
  };
};

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const timer = setTimeout(() => coldStartListeners.forEach((f) => f(true)), 3000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Request failed (${res.status})`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
    coldStartListeners.forEach((f) => f(false));
  }
}

export const get = <T = unknown>(path: string) => api<T>(path);
export const post = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const patch = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
