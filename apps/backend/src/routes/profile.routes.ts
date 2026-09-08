import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { verifyEnrollmentPassword } from '../services/actions/reauthentication.service.js';
import { clientOptions } from '../lib/shared-supabase.js';
import { PreferenceAuthorizationService } from '../services/actions/preference-authorization.service.js';
import { ActionRepository } from '../repositories/action.repository.js';
export async function createProfileRoutes(fastify: FastifyInstance, config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    supabaseAnonKey?: string;
}) {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    // GET /api/profile — Full profile + auth preference
    fastify.get('/api/profile', async (request: FastifyRequest, reply: FastifyReply) => {
        const { data: profile, error } = await request.database
            .from('customer_profiles')
            .select('id, full_name, email, phone, kyc_status, auth_preference, created_at')
            .eq('user_id', request.userId)
            .single();
        if (error || !profile) {
            return reply.code(404).send({ error: 'Profile not found.' });
        }
        const { data: settings, error: settingsError } = await supabase.from('banking_authorization_settings').select('customer_id').eq('customer_id', request.customerId).eq('user_id', request.userId).maybeSingle();
        if (settingsError) return reply.code(503).send({ error: 'Authorization setup unavailable. Apply database migrations.' });
        return reply.send({ ...profile, authorization_configured: !!settings });
    });
    // PATCH /api/profile/preferences — Update auth preference
    fastify.patch('/api/profile/preferences', async (request: FastifyRequest<{
        Body: {
            authPreference: string;
            pin?: string;
            password?: string;
            publicKey?: string;
        };
    }>, reply: FastifyReply) => {
        const { authPreference, pin, password, publicKey } = request.body || {};
        if (!['PIN','BIOMETRIC','TOTP'].includes(authPreference) || (authPreference === 'PIN' && !/^\d{6}$/.test(pin || '')) || (authPreference === 'BIOMETRIC' && !/^[0-9a-f]{64}$/.test(publicKey || ''))) return reply.code(400).send({ error: 'Valid authorization method and enrollment required' });
        await verifyEnrollmentPassword(request.principal, request.accessToken, password, request.database, () => createClient(config.supabaseUrl, config.supabaseAnonKey!, clientOptions));
        const { error } = await supabase.rpc('set_banking_authorization', { p_user_id: request.userId, p_customer_id: request.customerId, p_method: authPreference, p_pin: authPreference === 'PIN' ? pin : null, p_public_key: authPreference === 'BIOMETRIC' ? publicKey : null });
        if (error) return reply.code(400).send({ error: 'Unable to save preference. Enroll and verify TOTP before selecting it.' });
        return { success: true, authPreference };
    });
    fastify.get('/api/profile/authorization', request => new PreferenceAuthorizationService(supabase, new ActionRepository(supabase)).settings(request.principal));
    // GET /api/profile/products — List user's financial products
    fastify.get('/api/profile/products', async (request: FastifyRequest, reply: FastifyReply) => {
        const { data: products, error } = await request.database
            .from('customer_products')
            .select('id,product_type,product_name,product_number,linked_account_id,linked_card_id,currency,status')
            .eq('customer_id', request.customerId)
            .eq('status', 'ACTIVE');
        if (error) {
            return reply.code(500).send({ error: 'Failed to fetch products.' });
        }
        return reply.send(products || []);
    });
}
