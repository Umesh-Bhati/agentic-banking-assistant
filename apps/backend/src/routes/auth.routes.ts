import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface LoginBody {
  email?: string;
  password?: string;
}

export async function createAuthRoutes(
  fastify: FastifyInstance,
  config: { supabaseUrl: string; supabaseServiceKey: string }
) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  fastify.post('/api/auth/login', async (
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { email, password } = request.body || {};
      const targetEmail = (email || '').trim();
      const targetPassword = (password || '').trim();

      if (!targetEmail || !targetPassword) {
        return reply.code(400).send({ error: 'Email and password are required.' });
      }

      // Execute 100% real Supabase Auth with Email & Password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });

      if (error || !data.session) {
        return reply.code(401).send({
          error: error?.message || 'Invalid email or password. Please try again.',
        });
      }

      // Resolve customer profile ID if available
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('user_id', data.user.id)
        .single();

      return reply.send({
        success: true,
        token: data.session.access_token,
        user: data.user,
        customerId: profile?.id || data.user.id,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Internal server error during authentication.' });
    }
  });
}
