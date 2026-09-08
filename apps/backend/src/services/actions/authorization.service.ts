import {requireApprovedFactor} from './mfa-registry.service.js';
import { ActionRepository } from '../../repositories/action.repository.js';
import { ActionState, PendingAction, AuthCredentials } from '@boit/shared-types';
import { SupabaseClient } from '@supabase/supabase-js';
import { Principal } from '../../plugins/auth.plugin.js';
export type { AuthCredentials };
export interface VerifiedSession { token: string; refreshToken: string; expiresAt: number; }
export class AuthorizationCommitError extends Error {
    constructor(readonly session: VerifiedSession) { super('Authorization persistence unconfirmed'); }
}
export class AuthorizationService {
    constructor(private actionRepo: ActionRepository, private supabase: SupabaseClient) {
    }
    async challenge(actionId: string, principal: Principal, factorId: string, auth: SupabaseClient) {
        const action = await this.actionRepo.getById(actionId);
        if (!action || action.customerId !== principal.customerId || action.authUserId !== principal.authUserId || action.status !== ActionState.PENDING_AUTHORIZATION || Date.parse(action.expiresAt || '') <= Date.now())
            throw new Error('Action unavailable');
        await requireApprovedFactor(this.supabase,principal,factorId);
        const { data: factors, error: factorError } = await auth.auth.mfa.listFactors();
        if (factorError || !factors?.totp.some(f => f.id === factorId))
            throw new Error('Verified TOTP factor required');
        const { data, error } = await auth.auth.mfa.challenge({ factorId });
        if (error || !data)
            throw new Error('MFA challenge failed');
        const expiresAt = new Date(Math.min(Date.now() + 300000, Date.parse(action.expiresAt!))).toISOString();
        const { error: persistError } = await this.supabase.from('action_mfa_challenges').insert({ id: data.id, action_id: actionId, user_id: principal.authUserId, customer_id: principal.customerId, session_id: principal.sessionId, factor_id: factorId, action_version: action.version, expires_at: expiresAt });
        if (persistError)
            throw new Error('Unable to persist challenge');
        return { challengeId: data.id, expiresAt };
    }
    async authorizeAction(actionId: string, customerId: string, credentials: AuthCredentials, principal?: Principal, auth?: SupabaseClient): Promise<{
        action: PendingAction;
        session: {
            token: string;
            refreshToken: string;
            expiresAt: number;
        };
    }> {
        if (!principal || !auth || !credentials.challengeId || !/^\d{6}$/.test(credentials.code || '') || credentials.pin || credentials.biometricToken || credentials.password)
            throw new Error('Server-verified TOTP required');
        const { data: challenge, error } = await this.supabase.from('action_mfa_challenges').select('*').eq('id', credentials.challengeId).eq('action_id', actionId).eq('customer_id', customerId).eq('user_id', principal.authUserId).eq('session_id', principal.sessionId).single();
        if (error || !challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= Date.now())
            throw new Error('Challenge unavailable');
        await requireApprovedFactor(this.supabase,principal,challenge.factor_id);
        const { data: verified, error: verifyError } = await auth.auth.mfa.verify({ factorId: challenge.factor_id, challengeId: challenge.id, code: credentials.code! });
        if (verifyError || !verified || verified.user.id !== principal.authUserId)
            throw new Error('MFA verification failed');
        const session = { token: verified.access_token, refreshToken: verified.refresh_token, expiresAt: Math.floor(Date.now() / 1000) + verified.expires_in };
        try {
            const action = await this.actionRepo.rpc('authorize_action', { p_action_id: actionId, p_user_id: principal.authUserId, p_customer_id: customerId, p_session_id: principal.sessionId, p_challenge_id: challenge.id });
            return { action, session };
        } catch {
            // The identity provider may rotate tokens before the database rejects a stale action version.
            throw new AuthorizationCommitError(session);
        }
    }
}
