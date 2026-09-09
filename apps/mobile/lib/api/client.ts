import Constants from 'expo-constants';
import { apiPath, validateApiOrigin } from './policy';
const configured = process.env.EXPO_PUBLIC_API_URL;
export const API_ORIGIN = validateApiOrigin(configured || (__DEV__ ? `http://${Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost'}:3000` : ''), __DEV__);
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let unauthorized: ((token: string) => void) | undefined;
export function onUnauthorized(handler?: (token: string) => void) { unauthorized = handler; }
const active = new Set<AbortController>();
export function abortRequests() { for (const controller of active) controller.abort(); active.clear(); }
export async function request(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  active.add(controller);
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(`${API_ORIGIN}${apiPath(path)}`, {
      ...init, signal: controller.signal, redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json', ...(init.body == null ? {} : { 'Content-Type': 'application/json' }), 'X-Banking-Client-Version': '1', ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (response.redirected || (response.url && new URL(response.url).origin !== API_ORIGIN)) throw new Error('Unexpected redirect');
    if (response.status === 401 && token) unauthorized?.(token);
    if (!response.ok) throw new ApiError(response.status, response.status === 401 ? 'Your session has expired. Sign in again.' : `Request failed (${response.status}). Please try again.`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 10485760) throw new Error('Response exceeded the size limit');
    return new Response(response.status === 204 ? null : bytes, { status: response.status, headers: response.headers });
  } finally {
    clearTimeout(timeout); active.delete(controller); init.signal?.removeEventListener('abort', abort);
  }
}
export async function json<T>(path: string, token: string | null, body?: unknown, method?: string): Promise<T> {
  const response = await request(path, token, { method: method || (body === undefined ? 'GET' : 'POST'), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return response.status === 204 ? undefined as T : await response.json() as T;
}
