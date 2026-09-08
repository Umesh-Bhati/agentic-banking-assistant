import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { createChatRoute } from './routes/chat.js';
import { createActionRoutes } from './routes/action.routes.js';
import { createStatementRoute } from './routes/statements.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createProfileRoutes } from './routes/profile.routes.js';
import authPlugin from './plugins/auth.plugin.js';
import { getSharedSupabaseClient } from './lib/shared-supabase.js';
export async function createServer(): Promise<FastifyInstance> {
    if (process.env.BANKING_MODE !== 'simulator')
        throw new Error('Only explicit simulator mode is supported');
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_ANON_KEY'];
    for (const key of required)
        if (!process.env[key])
            throw new Error('Missing configuration: ' + key);
    if (process.env.NODE_ENV === 'production' && !process.env.SUPABASE_URL!.startsWith('https://'))
        throw new Error('Production requires HTTPS');
    if (!/^openai\/[a-zA-Z0-9.-]+$/.test(process.env.AI_MODEL || 'openai/gpt-4o-mini')) throw new Error('Approved AI model required');
    if (process.env.AI_ENABLED === 'true' && (!process.env.OPENAI_API_KEY || process.env.APPROVED_AI_PROVIDERS !== 'openai' || !/^openai\/[a-zA-Z0-9.-]+$/.test(process.env.AI_MODEL || 'openai/gpt-4o-mini')))
        throw new Error('Approved AI provider configuration required');
    const server = fastify({ bodyLimit: 16384, requestTimeout: 35000, logger: { redact: ['req.headers.authorization', 'req.body', 'res.headers["set-cookie"]'], serializers: { req: req => ({ method: req.method, url: req.url?.split('?')[0], id: req.id }) } } });
    server.setErrorHandler((error, request, reply) => {
        const err = error as {
            code?: string;
            statusCode?: number;
        };
        request.log.warn({ code: err.code, event: 'request_denied' }, 'Request failed');
        reply.code(err.statusCode || 400).send({ error: 'Request rejected' });
    });
    // Local limits bound each process; deployment must also enforce a shared edge limit.
    const limits = new Map<string, {
        count: number;
        until: number;
    }>();
    server.addHook('onRequest', async (request, reply) => {
        const now = Date.now();
        for (const [key, value] of limits)
            if (value.until < now)
                limits.delete(key);
        const sensitive = /\/api\/auth\/|\/challenge$|\/authorize$/.test(request.url.split('?')[0]);
        const key = request.ip + (sensitive ? ':auth' : ':api');
        if (limits.size >= 10000 && !limits.has(key))
            return reply.code(429).send({ error: 'Rate limit exceeded' });
        const entry = limits.get(key) || { count: 0, until: now + 60000 };
        entry.count++;
        limits.set(key, entry);
        if (entry.count > (sensitive ? 10 : 60))
            return reply.code(429).send({ error: 'Rate limit exceeded' });
    });
    server.get('/health', async () => ({ status: 'ok' }));
    server.get('/ready', async (_request, reply) => {
        const { error } = await getSharedSupabaseClient().from('revoked_sessions').select('session_id').limit(1);
        return error ? reply.code(503).send({ status: 'unavailable' }) : { status: 'ready' };
    });
    const settings = { supabaseUrl: process.env.SUPABASE_URL!, supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!, supabaseAnonKey: process.env.SUPABASE_ANON_KEY! };
    server.addHook('onRequest', async (request, reply) => {
        const path = request.url.split('?')[0];
        if (request.method === 'POST' && (path.startsWith('/actions/') || path.startsWith('/api/statements/')) && !path.endsWith('/cancel') && process.env.BANKING_MUTATIONS_ENABLED !== 'true')
            return reply.code(503).send({ error: 'Banking mutations are disabled' });
    });
    await server.register(authPlugin, settings);
    await createAuthRoutes(server, settings);
    await createProfileRoutes(server, settings);
    await createActionRoutes(server, settings);
    await createChatRoute(server, settings);
    await createStatementRoute(server, settings);
    return server;
}
export async function startServer(): Promise<void> {
    config();
    const server = await createServer();
    await server.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    startServer().catch(() => {
        process.stderr.write('Server startup failed\n');
        process.exitCode = 1;
    });
