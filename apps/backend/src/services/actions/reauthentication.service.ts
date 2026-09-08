import type { SupabaseClient } from '@supabase/supabase-js';
import type { Principal } from '../../plugins/auth.plugin.js';

/** Verify fresh credentials without replacing the customer's active app session. */
export async function verifyEnrollmentPassword(
    principal: Principal,
    accessToken: string,
    password: unknown,
    authenticated: SupabaseClient,
    isolatedClient: () => SupabaseClient,
): Promise<void> {
    if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
        throw new Error('Current password required for MFA enrollment');
    }
    const { data: identity, error: identityError } = await authenticated.auth.getUser(accessToken);
    if (identityError || !identity.user?.email || identity.user.id !== principal.authUserId) {
        throw new Error('Unable to verify enrollment identity');
    }
    // Email comes from the verified authority response, never the request body or profile table.
    const proofClient = isolatedClient();
    const { data, error } = await proofClient.auth.signInWithPassword({ email: identity.user.email, password });
    if (!data.session) {
        throw new Error('Password verification failed');
    }
    // Even a mismatched response must have its temporary refresh-capable session revoked.
    const { error: cleanupError } = await proofClient.auth.signOut({ scope: 'local' });
    if (cleanupError) {
        throw new Error('Unable to close credential verification session');
    }
    if (error || !data.user || data.user.id !== principal.authUserId || data.session.user.id !== principal.authUserId) {
        throw new Error('Password verification failed');
    }
}
