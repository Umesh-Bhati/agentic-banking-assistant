import fp from 'fastify-plugin';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { clientOptions, userClient } from '../lib/shared-supabase.js';
export interface Principal {
    readonly authUserId: string;
    readonly customerId: string;
    readonly sessionId: string;
    readonly expiresAt: number;
}
declare module 'fastify' {
    interface FastifyRequest {
        userId: string;
        customerId: string;
        principal: Principal;
        accessToken: string;
        database: SupabaseClient;
    }
}
export default fp(async function authPlugin(fastify, opts: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    supabaseAnonKey?: string;
}) {
    const admin = createClient(opts.supabaseUrl, opts.supabaseServiceKey, clientOptions);
    for (const key of ['userId', 'customerId', 'accessToken'])
        fastify.decorateRequest(key, '');
    fastify.decorateRequest('principal');
    fastify.decorateRequest('database');
    fastify.addHook('onRequest', async (request, reply) => {
        const path = request.url.split('?')[0];
        if (['/health', '/ready', '/api/auth/login', '/api/auth/signup', '/api/auth/refresh'].includes(path))
            return;
        const match = /^Bearer ([^\s]+)$/.exec(request.headers.authorization || '');
        if (!match || (request.query as any)?.token || (request.query as any)?.access_token)
            return reply.code(401).send({ error: 'Bearer authentication required' });
        try {
            const token = match[1];
            const { data: { user }, error } = await admin.auth.getUser(token);
            if (error || !user)
                throw new Error();
            // Claims are inspected only after the authority has verified the token.
            const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
            if (claims.sub !== user.id || !claims.session_id || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= Date.now() || !(claims.aud === 'authenticated' || (Array.isArray(claims.aud) && claims.aud.includes('authenticated'))) || claims.iss !== `${opts.supabaseUrl.replace(/\/$/, '')}/auth/v1` || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id))
                throw new Error();
            const { data: revoked, error: revokeError } = await admin.from('revoked_sessions').select('session_id').eq('session_id', claims.session_id).maybeSingle();
            if (revokeError || revoked)
                throw new Error();
            const db = userClient(opts.supabaseUrl, opts.supabaseAnonKey!, token);
            const { data: profile, error: profileError } = await db.from('customer_profiles').select('id').eq('user_id', user.id).single();
            if (profileError || !profile)
                throw new Error();
            request.principal = Object.freeze({ authUserId: user.id, customerId: profile.id, sessionId: claims.session_id, expiresAt: claims.exp });
            request.userId = user.id;
            request.customerId = profile.id;
            request.accessToken = token;
            request.database = db;
        }
        catch {
            request.log.warn({ event: 'authentication_denied' }, 'Authentication denied');
            return reply.code(401).send({ error: 'Invalid session or unavailable identity verification' });
        }
    });
});
