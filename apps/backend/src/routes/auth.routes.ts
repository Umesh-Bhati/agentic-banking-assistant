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

  // POST /api/auth/signup — Create a new user account
  fastify.post('/api/auth/signup', async (
    request: FastifyRequest<{ Body: { email: string; password: string; fullName: string; phone?: string; authPreference?: string; pin?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { email, password, fullName, phone, authPreference, pin } = request.body || {};

      if (!email?.trim() || !password?.trim() || !fullName?.trim()) {
        return reply.code(400).send({ error: 'Email, password, and full name are required.' });
      }

      // 1. Create auth user via Supabase Admin API (service role)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password: password.trim(),
        email_confirm: true,
        user_metadata: { full_name: fullName.trim() },
      });

      if (authError || !authData.user) {
        return reply.code(400).send({ error: authError?.message || 'Failed to create user account.' });
      }

      // 2. Create customer profile with auth preference
      const validPreference = ['PIN', 'BIOMETRIC', 'CREDENTIALS'].includes(authPreference || '') 
        ? authPreference! 
        : 'PIN';

      const { data: profile, error: profileError } = await supabase
        .from('customer_profiles')
        .insert({
          user_id: authData.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone?.trim() || '+971500000000',
          kyc_status: 'VERIFIED',
          auth_preference: validPreference,
        })
        .select()
        .single();

      if (profileError || !profile) {
        // Cleanup: delete the auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        return reply.code(500).send({ error: 'Failed to create customer profile.' });
      }

      // 3. Set PIN hash if PIN provided
      if (pin && /^\d{4}$/.test(pin)) {
        await supabase.rpc('set_customer_pin', {
          p_customer_id: profile.id,
          p_pin: pin,
        });
      }

      // 4. Create default bank account for the new user
      await supabase.from('bank_accounts').insert({
        customer_id: profile.id,
        account_number: `AE${Date.now()}${Math.floor(Math.random() * 1000)}`,
        balance: 10000.00,
        currency: 'AED',
        type: 'CURRENT',
        status: 'ACTIVE',
      });

      // 5. Sign in and return token
      const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError || !session.session) {
        return reply.code(500).send({ error: 'Account created but login failed. Please try logging in.' });
      }

      return reply.send({
        success: true,
        token: session.session.access_token,
        user: session.user,
        customerId: profile.id,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Internal server error during signup.' });
    }
  });
}
