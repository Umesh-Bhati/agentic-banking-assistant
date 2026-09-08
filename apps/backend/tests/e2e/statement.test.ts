import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
import { query, principal } from '../helpers/database.js';
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
import { createStatementRoute } from '../../src/routes/statements.js';
async function makeApp(status: string) {
    const app = fastify();
    app.addHook('onRequest', async (request) => {
        request.customerId = principal.customerId;
        request.database = { from: () => query({ data: { status, transactions_snapshot: [{ created_at: '2026-08-01', amount: '25.00', currency: 'AED', description: 'test' }] }, error: null }) } as any;
    });
    await createStatementRoute(app, { supabaseUrl: 'http://localhost:54321', supabaseServiceKey: 'test' });
    return app;
}
describe('Statement downloads', () => {
    it('retires URL-based direct generation', async () => {
        const app = await makeApp('ISSUED');
        expect((await app.inject('/api/statements?accountId=any')).statusCode).toBe(410);
        await app.close();
    });
    it('does not download an unissued quote', async () => {
        const app = await makeApp('QUOTED');
        expect((await app.inject('/api/statements/id/download')).statusCode).toBe(404);
        await app.close();
    });
    it('renders persisted snapshot with no-store caching', async () => {
        const app = await makeApp('ISSUED');
        const response = await app.inject('/api/statements/id/download');
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
        await app.close();
    });
});
