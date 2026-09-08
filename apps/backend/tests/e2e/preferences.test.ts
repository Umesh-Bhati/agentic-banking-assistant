import { describe, expect, it, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import { principal, query } from '../helpers/database.js';
const state = vi.hoisted(() => ({ configured: false, reauthenticate: vi.fn(), rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => query({ data: state.configured ? { customer_id: 'customer' } : null, error: null }), rpc: state.rpc }) }));
vi.mock('../../src/services/actions/reauthentication.service.js', () => ({ verifyEnrollmentPassword: state.reauthenticate }));
import { createProfileRoutes } from '../../src/routes/profile.routes.js';
beforeEach(() => { vi.clearAllMocks(); state.configured = false; state.reauthenticate.mockResolvedValue(undefined); state.rpc.mockResolvedValue({ error: null }); });
async function app() {
 const server = fastify();
 server.addHook('onRequest', async request => {
  request.principal = principal; request.userId = principal.authUserId; request.customerId = principal.customerId; request.accessToken = 'token';
  request.database = { from: () => query({ data: { id: principal.customerId, auth_preference: 'TOTP' }, error: null }) } as any;
 });
 await createProfileRoutes(server, { supabaseUrl: 'http://localhost', supabaseServiceKey: 'key', supabaseAnonKey: 'anon' });
 return server;
}
describe('first-login authorization enrollment', () => {
 it.each([false, true])('reports explicit enrollment=%s instead of treating default TOTP as configured', async configured => {
  state.configured = configured; const server = await app();
  const response = await server.inject('/api/profile');
  expect(response.statusCode).toBe(200); expect(response.json().authorization_configured).toBe(configured);
  await server.close();
 });
 it('rejects preference changes when fresh-password proof fails', async () => {
  state.reauthenticate.mockRejectedValue(new Error('Password verification failed')); const server = await app();
  const response = await server.inject({ method: 'PATCH', url: '/api/profile/preferences', payload: { authPreference: 'PIN', pin: '654321', password: 'wrong' } });
  expect(response.statusCode).not.toBe(200); expect(state.rpc).not.toHaveBeenCalled(); await server.close();
 });
 it('saves the selected method only after fresh reauthentication', async () => {
  const server = await app();
  const response = await server.inject({ method: 'PATCH', url: '/api/profile/preferences', payload: { authPreference: 'PIN', pin: '654321', password: 'current' } });
  expect(response.statusCode).toBe(200); expect(state.reauthenticate).toHaveBeenCalledOnce();
  expect(state.rpc).toHaveBeenCalledWith('set_banking_authorization', expect.objectContaining({ p_method: 'PIN', p_customer_id: principal.customerId, p_user_id: principal.authUserId })); await server.close();
 });
});
