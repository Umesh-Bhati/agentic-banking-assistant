import type { SupabaseClient } from '@supabase/supabase-js';
import type { Principal } from '../../plugins/auth.plugin.js';

/** Provider factors alone do not prove they passed the bank's enrollment policy. */
export async function requireApprovedFactor(database: SupabaseClient, principal: Principal, factorId: string): Promise<void> {
    const { data, error } = await database.from('banking_mfa_factors')
        .select('factor_id')
        .eq('factor_id', factorId)
        .eq('user_id', principal.authUserId)
        .eq('customer_id', principal.customerId)
        .maybeSingle();
    if (error || data?.factor_id !== factorId) {
        throw new Error('Bank-approved MFA enrollment required');
    }
}
