import { afterEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { Object.assign(globalThis, { __DEV__: false }); process.env.EXPO_PUBLIC_API_URL = 'https://bank.example'; });
vi.mock('expo-constants', () => ({ default: {} }));
import { abortRequests, json, onUnauthorized, request } from './client';
afterEach(() => { abortRequests(); onUnauthorized(undefined); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('authenticated transport', () => {
  it('sends credentials only in headers to fixed bank routes', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    expect(await json('/api/profile', 'private-token')).toEqual({ ok: true });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://bank.example/api/profile');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer private-token' } });
    await expect(json('https://evil.example/steal', 'private-token')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('revokes local session state on server authentication rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    const expire = vi.fn(); onUnauthorized(expire);
    await expect(json('/api/profile', 'expired')).rejects.toThrow('Sign in again');
    expect(expire).toHaveBeenCalledWith('expired');
  });
  it('keeps response bodies cancellable after headers arrive', async () => {
    let bodyStarted!: () => void;
    const started = new Promise<void>(resolve => { bodyStarted = resolve; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => ({
      ok: true, status: 200, url: 'https://bank.example/api/profile', redirected: false, headers: new Headers(),
      arrayBuffer: () => new Promise<ArrayBuffer>((_resolve, reject) => { bodyStarted(); init?.signal?.addEventListener('abort', () => reject(new Error('Body aborted'))); }),
    } as Response));
    const operation = request('/api/profile', 'private');
    const rejected = expect(operation).rejects.toThrow('Body aborted');
    await started; abortRequests(); await rejected;
  });
  it('does not automatically retry mutations or claim non-success status succeeded', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await expect(json('/actions/id/authorize', 'private', { code: '123456' })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
