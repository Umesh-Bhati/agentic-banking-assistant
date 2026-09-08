import { describe, it, expect, vi } from 'vitest';
import { AuthorizationService } from '../../src/services/actions/authorization.service.js';
import { query, principal } from '../helpers/database.js';
describe('MFA fail-closed authorization', () => {
    it.each([{ pin: '1234' }, { biometricToken: 'verified' }, { email: 'a@b.com', password: 'correct' }])('rejects legacy credential %j', async (credentials) => {
        const rpc = vi.fn();
        const service = new AuthorizationService({ rpc } as any, {} as any);
        await expect(service.authorizeAction('action', principal.customerId, credentials)).rejects.toThrow('TOTP');
        expect(rpc).not.toHaveBeenCalled();
    });
    it.each([true, false])('rejects expired or consumed challenges before provider call (%s)', async (consumed) => {
        const challenge = { id: 'challenge', consumed_at: consumed ? 'today' : null, expires_at: new Date(Date.now() - 1).toISOString() };
        const verify = vi.fn();
        const rpc = vi.fn();
        const service = new AuthorizationService({ rpc } as any, { from: () => query({ data: challenge, error: null }) } as any);
        await expect(service.authorizeAction('action', principal.customerId, { challengeId: 'challenge', code: '123456' }, principal, { auth: { mfa: { verify } } } as any)).rejects.toThrow('unavailable');
        expect(verify).not.toHaveBeenCalled();
        expect(rpc).not.toHaveBeenCalled();
    });
    it('does not authorize on verification outage', async () => {
        const challenge = { id: 'challenge', factor_id: 'factor', expires_at: new Date(Date.now() + 100000).toISOString() };
        const rpc = vi.fn();
        const service = new AuthorizationService({ rpc } as any, { from: () => query({ data: challenge, error: null }) } as any);
        await expect(service.authorizeAction('action', principal.customerId, { challengeId: 'challenge', code: '123456' }, principal, { auth: { mfa: { verify: async () => ({ data: null, error: { message: 'outage' } }) } } } as any)).rejects.toThrow('verification failed');
        expect(rpc).not.toHaveBeenCalled();
    });
});
describe('Concurrent MFA token isolation', () => {
    it('keeps verification responses local even when a service is reused', async () => {
        const rpc = vi.fn(async (_name, args) => ({ id: args.p_action_id }));
        const database = { from: () => query({ data: { id: 'challenge', factor_id: 'factor', expires_at: new Date(Date.now() + 100000).toISOString() }, error: null }) };
        const service = new AuthorizationService({ rpc } as any, database as any);
        const verify = (id: string, delay: number) => ({ auth: { mfa: { verify: async () => {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return { data: { user: { id }, access_token: 'access-' + id, refresh_token: 'refresh-' + id, expires_in: 3600 }, error: null };
                    } } } });
        const second = { ...principal, authUserId: 'second-user', customerId: 'second-customer' };
        const results = await Promise.all([
            service.authorizeAction('one', principal.customerId, { challengeId: 'challenge', code: '123456' }, principal, verify(principal.authUserId, 10) as any),
            service.authorizeAction('two', second.customerId, { challengeId: 'challenge', code: '123456' }, second, verify(second.authUserId, 1) as any),
        ]);
        expect(results[0].session.token).toBe('access-' + principal.authUserId);
        expect(results[1].session.token).toBe('access-second-user');
    });
});
