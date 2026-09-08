import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { requireApprovedFactor } from '../services/actions/mfa-registry.service.js';
import { verifyEnrollmentPassword } from '../services/actions/reauthentication.service.js';
import { clientOptions } from '../lib/shared-supabase.js';
export async function createAuthRoutes(fastify: FastifyInstance, config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    supabaseAnonKey?: string;
}) {
    const client = () => createClient(config.supabaseUrl, config.supabaseAnonKey!, clientOptions);
    const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, clientOptions);
    const sessionResponse = async (data: any) => {
        if (!data?.session || !data.user)
            throw new Error('Authentication failed');
        const { data: profile, error } = await admin.from('customer_profiles').select('id').eq('user_id', data.user.id).single();
        if (error || !profile)
            throw new Error('Customer enrollment required');
        return { success: true, token: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, user: { id: data.user.id, email: data.user.email }, customerId: profile.id };
    };
    fastify.post<{
        Body: {
            email: string;
            password: string;
        };
    }>('/api/auth/login', async (request, reply) => {
        const { email, password } = request.body || {};
        if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024)
            return reply.code(400).send({ error: 'Invalid credentials' });
        const { data, error } = await client().auth.signInWithPassword({ email: email.trim(), password });
        if (error)
            return reply.code(401).send({ error: 'Authentication failed' });
        try {
            return await sessionResponse(data);
        }
        catch {
            return reply.code(403).send({ error: 'Customer enrollment required' });
        }
    });
    // Customer and account provisioning is an administrative, audited banking process.
    fastify.post('/api/auth/signup', async (_request, reply) => reply.code(403).send({ error: 'Bank-managed enrollment required' }));
    fastify.post<{
        Body: {
            refreshToken: string;
        };
    }>('/api/auth/refresh', async (request, reply) => {
        if (typeof request.body?.refreshToken !== 'string' || request.body.refreshToken.length > 4096)
            return reply.code(400).send({ error: 'Refresh token required' });
        const { data, error } = await client().auth.refreshSession({ refresh_token: request.body.refreshToken });
        if (error || !data.session)
            return reply.code(401).send({ error: 'Session expired' });
        const claims = JSON.parse(Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString());
        const { data: revoked, error: revocationError } = await admin.from('revoked_sessions').select('session_id').eq('session_id', claims.session_id).maybeSingle();
        if (revocationError || revoked)
            return reply.code(401).send({ error: 'Session revoked' });
        return sessionResponse(data);
    });
    fastify.post('/api/auth/logout', async (request) => {
        const { error } = await admin.from('revoked_sessions').upsert({ session_id: request.principal.sessionId, user_id: request.userId, expires_at: new Date(request.principal.expiresAt * 1000).toISOString() });
        if (error)
            throw new Error('Unable to revoke session');
        const { error: signOutError } = await admin.auth.admin.signOut(request.accessToken, 'local');
        if (signOutError)
            throw new Error('Session revoked locally; provider logout unavailable');
        return { success: true };
    });
    fastify.get('/api/auth/mfa/factors', async (request) => {
        const { data, error } = await request.database.auth.mfa.listFactors();
        if (error)
            throw new Error('Unable to read factors');
        const {data: registrations, error: registrationError} = await admin.from('banking_mfa_factors')
            .select('factor_id').eq('user_id',request.userId).eq('customer_id',request.customerId);
        if (registrationError) throw new Error('Unable to read approved factors');
        const approved = new Set((registrations || []).map(row => row.factor_id));
        return { factors: data.all.filter(factor => factor.factor_type === 'totp' && approved.has(factor.id)) };
    });
    fastify.post<{ Body: { password?: string } }>('/api/auth/mfa/enroll', async (request) => {
        await verifyEnrollmentPassword(request.principal, request.accessToken, request.body?.password, request.database, client);
        const { data: existing, error: existingError } = await request.database.auth.mfa.listFactors();
        if (existingError || existing.all.some(factor => factor.factor_type === 'totp'))
            throw new Error('Existing factor changes require administrative recovery');
        const { data, error } = await request.database.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Banking authorization' });
        if (error || !data) throw new Error('Unable to enroll factor');
        const {error: registrationError} = await admin.from('banking_mfa_factors').insert({
            factor_id:data.id,user_id:request.userId,customer_id:request.customerId,
        });
        if (registrationError) {
            // Never release a secret until bank policy registration is durable.
            try { await request.database.auth.mfa.unenroll({factorId:data.id}); } catch { /* Administrative cleanup may be required. */ }
            throw new Error('Unable to register approved factor');
        }
        return data;
    });
    fastify.post<{
        Body: {
            factorId: string;
            code: string;
        };
    }>('/api/auth/mfa/verify-enrollment', async (request) => {
        const { factorId, code } = request.body || {};
        if (!factorId || !/^\d{6}$/.test(code || ''))
            throw new Error('TOTP required');
        await requireApprovedFactor(admin,request.principal,factorId);
        const { data, error } = await request.database.auth.mfa.challengeAndVerify({ factorId, code });
        if (error || !data || data.user.id !== request.userId)
            throw new Error('MFA verification failed');
        return { success: true, token: data.access_token, refreshToken: data.refresh_token, expiresAt: Math.floor(Date.now() / 1000) + data.expires_in };
    });
}
