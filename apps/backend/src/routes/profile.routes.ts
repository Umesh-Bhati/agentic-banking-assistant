import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

export async function createProfileRoutes(
  fastify: FastifyInstance,
  config: { supabaseUrl: string; supabaseServiceKey: string }
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  // GET /api/profile — Full profile + auth preference
  fastify.get('/api/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data: profile, error } = await supabase
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
  fastify.patch('/api/profile/preferences', async (
    request: FastifyRequest<{ Body: { authPreference: string; pin?: string } }>,
    reply: FastifyReply
  ) => {
    const { authPreference, pin } = request.body || {};

    if (!authPreference || !['PIN', 'BIOMETRIC', 'CREDENTIALS'].includes(authPreference)) {
      return reply.code(400).send({ error: 'Invalid auth preference. Must be PIN, BIOMETRIC, or CREDENTIALS.' });
    }

    const { error } = await supabase
      .from('customer_profiles')
      .update({ auth_preference: authPreference })
      .eq('user_id', request.userId);

    if (error) {
      return reply.code(500).send({ error: 'Failed to update preference.' });
    }

    // If switching to PIN and a new PIN is provided, set it
    if (authPreference === 'PIN' && pin) {
      await supabase.rpc('set_customer_pin', {
        p_customer_id: request.customerId,
        p_pin: pin,
      });
    }

    return reply.send({ success: true, authPreference });
  });

  // GET /api/profile/products — List user's financial products
  fastify.get('/api/profile/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data: products, error } = await supabase
      .from('customer_products')
      .select('*')
      .eq('customer_id', request.customerId)
      .eq('status', 'ACTIVE');

    if (error) {
      return reply.code(500).send({ error: 'Failed to fetch products.' });
    }
    return reply.send(products || []);
  });
}
