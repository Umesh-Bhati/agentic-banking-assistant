import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: vi.fn(), rpc: vi.fn() }) }));
import { createActionRoutes } from '../../src/routes/action.routes.js';
describe('Legacy action authorization rejected', () => {
    it.each([{ pin: '1234' }, { biometricToken: 'bio_verified' }, { password: 'password' }])('rejects %j even on authenticated route', async (payload) => {
        const app = fastify();
        app.setErrorHandler((error, _request, reply) => reply.code(400).send({ error: (error as Error).message }));
        app.addHook('onRequest', async (request) => {
            request.customerId = 'customer';
            request.userId = 'auth';
        });
        await createActionRoutes(app, { supabaseUrl: 'http://localhost:54321', supabaseServiceKey: 'test' });
        const response = await app.inject({ method: 'POST', url: '/actions/action/authorize', payload });
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toContain('TOTP');
        await app.close();
    });
});
