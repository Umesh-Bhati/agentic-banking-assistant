import { beforeEach, describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
import { query, principal } from '../helpers/database.js';
const state = vi.hoisted(() => ({ verificationError: false, revoked: false, profile: true, revocationError: false, getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: state.getUser }, from: (table: string) => query(table === 'revoked_sessions' ? { data: state.revoked ? { session_id: 'id' } : null, error: state.revocationError ? {} : null } : { data: state.profile ? { id: 'customer' } : null, error: null }) }) }));
import authPlugin from '../../src/plugins/auth.plugin.js';
const url = 'http://localhost:54321';
function token(overrides: Record<string, unknown> = {}) {
    const claims = { sub: principal.authUserId, session_id: principal.sessionId, exp: Math.floor(Date.now() / 1000) + 1000, aud: 'authenticated', iss: url + '/auth/v1', ...overrides };
    return 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
}
async function request(bearer: string, path = '/private') {
    const app = fastify();
    await app.register(authPlugin, { supabaseUrl: url, supabaseServiceKey: 'service', supabaseAnonKey: 'anon' });
    app.get('/private', async (req) => ({ principal: req.principal }));
    const response = await app.inject({ url: path, headers: { authorization: 'Bearer ' + bearer } });
    await app.close();
    return response;
}
beforeEach(() => {
    state.revoked = false;
    state.profile = true;
    state.revocationError = false;
    state.getUser.mockReset().mockResolvedValue({ data: { user: { id: principal.authUserId } }, error: null });
});
describe('Authoritative bearer authentication', () => {
    it('rejects forged token when authority rejects even apparently valid claims', async () => {
        state.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad signature' } });
        expect((await request(token())).statusCode).toBe(401);
    });
    it.each([{ exp: undefined }, { exp: 1 }, { sub: 'other' }, { aud: 'not-authenticated' }, { iss: 'https://evil/auth/v1' }, { session_id: 'fake' }])('rejects invalid verified claims %j', async (claims) => expect((await request(token(claims))).statusCode).toBe(401));
    it('accepts valid verified session with immutable distinct principal', async () => {
        const response = await request(token());
        expect(response.statusCode).toBe(200);
        expect(response.json().principal).toMatchObject({ authUserId: principal.authUserId, customerId: 'customer' });
        expect(state.getUser).toHaveBeenCalledTimes(1);
    });
    it('rejects missing profiles rather than substituting auth ID', async () => {
        state.profile = false;
        expect((await request(token())).statusCode).toBe(401);
    });
    it('rejects revoked sessions and revocation outages', async () => {
        state.revoked = true;
        expect((await request(token())).statusCode).toBe(401);
        state.revoked = false;
        state.revocationError = true;
        expect((await request(token())).statusCode).toBe(401);
    });
    it('rejects query tokens even when bearer header is valid', async () => {
        expect((await request(token(), '/private?token=secret')).statusCode).toBe(401);
        expect(state.getUser).not.toHaveBeenCalled();
    });
});
