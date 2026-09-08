import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
export async function createProfileRoutes(fastify: FastifyInstance, config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
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
        return reply.send(profile);
    });
    // PATCH /api/profile/preferences — Update auth preference
    fastify.patch('/api/profile/preferences', async (request: FastifyRequest<{
        Body: {
            authPreference: string;
            pin?: string;
        };
    }>, reply: FastifyReply) => {
        return reply.code(409).send({ error: 'TOTP authorization is mandatory. Factor recovery requires bank support.' });
    });
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
