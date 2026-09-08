import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../lib/api/client', () => ({ ApiError: class extends Error {
  constructor(public status: number, message: string) { super(message); }
} }));
import { ApiError } from '../../../lib/api/client';
import { chatRunError } from './run-error';

const active = () => ({ isCurrent: () => true, isCancelled: () => false, expireSession: vi.fn(async () => {}) });
describe('chat runtime failure boundary', () => {
  it('reports disabled AI as incomplete without exposing diagnostics or successful content', async () => {
    const failure = await chatRunError(new ApiError(503, 'secret provider details'), active());
    expect(failure?.status).toMatchObject({ type: 'incomplete', reason: 'error' });
    expect(failure?.status).toHaveProperty('error', expect.stringContaining('AI chat is currently unavailable'));
    expect(failure?.content).toEqual([]);
    expect(JSON.stringify(failure)).not.toContain('secret provider details');
  });
  it('keeps action-status recovery guidance for network or partial-stream failure', async () => {
    const failure = await chatRunError(new Error('token=private'), active());
    expect(failure?.status).toHaveProperty('error', expect.stringContaining('check bank status'));
    expect(JSON.stringify(failure)).not.toContain('token=private');
  });
  it('expires a current unauthorized session without adding stale chat content', async () => {
    const state = active();
    expect(await chatRunError(new ApiError(401, 'expired'), state)).toBeUndefined();
    expect(state.expireSession).toHaveBeenCalledOnce();
  });
  it('does not reject again if signed-out secure-storage cleanup fails', async () => {
    const state = { ...active(), expireSession: vi.fn(async () => { throw new Error('storage unavailable'); }) };
    expect(await chatRunError(new ApiError(401, 'expired'), state)).toBeUndefined();
    expect(state.expireSession).toHaveBeenCalledOnce();
  });
  it.each(['cancelled', 'account-changed'])('silently ignores %s failures without expiring another session', async mode => {
    const state = { ...active(), isCancelled: () => mode === 'cancelled', isCurrent: () => mode !== 'account-changed' };
    expect(await chatRunError(new ApiError(401, 'late response'), state)).toBeUndefined();
    expect(state.expireSession).not.toHaveBeenCalled();
  });
});
