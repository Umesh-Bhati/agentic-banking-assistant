import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
// Mock Supabase Auth
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            signInWithPassword: vi.fn(async ({ email, password }) => {
                if (password === 'provider-down') {
                    return { data: { session: null, user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'sensitive provider diagnostic' } };
                }
                if (password === 'invalidpass') {
                    return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } };
                }
                return {
                    data: {
                        session: { access_token: 'mock-jwt-token-123' },
                        user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email },
                    },
                    error: null,
                };
            }),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: {
                    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                    user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                    email: 'john.doe@gmail.com',
                },
                error: null,
            }),
        })),
    })),
}));
import { createAuthRoutes } from '../../src/routes/auth.routes.js';
describe('Auth Route E2E', () => {
    it('returns 503 without provider diagnostics when authentication is unavailable', async () => {
        const app = fastify();
        await createAuthRoutes(app, { supabaseUrl: 'http://localhost:54321', supabaseServiceKey: 'test' });
        const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'john.doe@gmail.com', password: 'provider-down' } });
        expect(response.statusCode).toBe(503);
        expect(response.json().error).toContain('temporarily unavailable');
        expect(response.payload).not.toContain('sensitive provider diagnostic');
        await app.close();
    });
    it('should return 200 OK and JWT token for valid credentials', async () => {
        const app = fastify();
        await createAuthRoutes(app, {
            supabaseUrl: 'http://localhost:54321',
            supabaseServiceKey: 'test',
        });
        const res = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'john.doe@gmail.com', password: 'validpassword' },
        });
        expect(res.statusCode).toBe(200);
        const data = JSON.parse(res.payload);
        expect(data.success).toBe(true);
        expect(data.token).toBe('mock-jwt-token-123');
    });
    it('should return 401 Unauthorized for invalid password', async () => {
        const app = fastify();
        await createAuthRoutes(app, {
            supabaseUrl: 'http://localhost:54321',
            supabaseServiceKey: 'test',
        });
        const res = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'john.doe@gmail.com', password: 'invalidpass' },
        });
        expect(res.statusCode).toBe(401);
        const data = JSON.parse(res.payload);
        expect(data.error).toContain('Authentication failed');
    });
});
