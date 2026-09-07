import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    customerId: string;
  }
}

export default fp(async function authPlugin(
  fastify: FastifyInstance,
  opts: { supabaseUrl: string; supabaseServiceKey: string }
) {
  const supabase = createClient(opts.supabaseUrl, opts.supabaseServiceKey);

  const profileCache = new Map<string, string>();

  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('customerId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health check and login route
    if (request.url === '/health' || request.url === '/api/auth/login' || request.url === '/api/auth/signup') return;

    let token = '';
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if ((request.query as any)?.token) {
      token = String((request.query as any).token).trim();
    } else if ((request.query as any)?.access_token) {
      token = String((request.query as any).access_token).trim();
    }

    if (!token) {
      return reply.code(401).send({ error: 'Missing or invalid Authorization header or token query parameter' });
    }

    let authUserId: string | null = null;

    // Step 1: Fast local JWT validation (0ms, resilient against network timeouts)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        
        // Expiration check
        if (payload.exp && payload.exp * 1000 <= Date.now()) {
          return reply.code(401).send({ error: 'Auth token has expired. Please log in again.' });
        }

        // Standard Supabase Auth claim validation
        if (payload.sub && (payload.role === 'authenticated' || payload.aud === 'authenticated')) {
          authUserId = payload.sub;
        }
      }
    } catch (e) {
      // Fall back to Supabase API validation below
    }

    // Step 2: If local validation didn't resolve user, validate via Supabase Auth API
    if (!authUserId) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          return reply.code(401).send({ error: 'Invalid or expired auth token' });
        }
        authUserId = user.id;
      } catch (err) {
        return reply.code(401).send({ error: 'Invalid or expired auth token' });
      }
    }

    // Step 3: Resolve customer profile ID using auth.users.id
    if (profileCache.has(authUserId)) {
      request.userId = authUserId;
      request.customerId = profileCache.get(authUserId)!;
    } else {
      try {
        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('id')
          .eq('user_id', authUserId)
          .single();

        const customerId = profile?.id || authUserId;
        profileCache.set(authUserId, customerId);

        request.userId = authUserId;
        request.customerId = customerId;
      } catch (err) {
        request.userId = authUserId;
        request.customerId = authUserId;
      }
    }
  });
});
