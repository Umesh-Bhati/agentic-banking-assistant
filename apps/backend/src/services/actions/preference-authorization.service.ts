import { createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Principal } from '../../plugins/auth.plugin.js';
import { ActionRepository } from '../../repositories/action.repository.js';

export function verifyDeviceSignature(publicKey: string, payload: string, signature: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(publicKey) || !/^[0-9a-f]{128}$/.test(signature)) return false;
    try {
        const key = createPublicKey({ key: Buffer.from('302a300506032b6570032100' + publicKey, 'hex'), format: 'der', type: 'spki' });
        return verify(null, Buffer.from(payload, 'utf8'), key, Buffer.from(signature, 'hex'));
    } catch { return false; }
}
export class PreferenceAuthorizationService {
    constructor(private database: SupabaseClient, private repository: ActionRepository) {}
    async settings(principal: Principal) {
        const { data: profile, error } = await this.database.from('customer_profiles').select('auth_preference').eq('id', principal.customerId).eq('user_id', principal.authUserId).single();
        if (error || !profile) throw new Error('Authorization preference unavailable');
        const { data: settings, error: settingsError } = await this.database.from('banking_authorization_settings').select('version,public_key,locked_until').eq('customer_id', principal.customerId).eq('user_id', principal.authUserId).maybeSingle();
        if (settingsError) throw new Error('Authorization settings unavailable. Apply database migrations.');
        if (!settings) throw new Error('Choose and configure an authorization method in Preferences first');
        return { method: profile.auth_preference as 'PIN' | 'BIOMETRIC' | 'TOTP', version: settings?.version, publicKey: settings?.public_key as string | null, lockedUntil: settings?.locked_until };
    }
    async challenge(actionId: string, principal: Principal) {
        const settings = await this.settings(principal);
        if (!['PIN', 'BIOMETRIC'].includes(settings.method) || !settings.version) throw new Error('Authorization not configured');
        const action = await this.repository.getById(actionId);
        if (!action || action.customerId !== principal.customerId || action.authUserId !== principal.authUserId || action.status !== 'PENDING_AUTHORIZATION' || !action.expiresAt || Date.parse(action.expiresAt) <= Date.now()) throw new Error('Action unavailable');
        const id = randomUUID();
        const expiresAt = new Date(Math.min(Date.now() + 300000, Date.parse(action.expiresAt))).toISOString();
        const payload = JSON.stringify({ purpose: 'banking-authorization-v1', challengeId: id, actionId, actionVersion: action.version, customerId: principal.customerId, userId: principal.authUserId, sessionId: principal.sessionId, method: settings.method, settingsVersion: settings.version, nonce: randomBytes(32).toString('hex'), expiresAt });
        const { error } = await this.database.from('banking_authorization_challenges').insert({ id, action_id: actionId, action_version: action.version, user_id: principal.authUserId, customer_id: principal.customerId, session_id: principal.sessionId, method: settings.method, settings_version: settings.version, payload, expires_at: expiresAt });
        if (error) throw new Error('Unable to create authorization challenge');
        return { challengeId: id, expiresAt, payload, method: settings.method, publicKey: settings.publicKey };
    }
    async authorize(actionId: string, principal: Principal, credentials: { challengeId: string; pin?: string; signature?: string }) {
        const settings = await this.settings(principal);
        const { data: challenge, error } = await this.database.from('banking_authorization_challenges').select('*').eq('id', credentials.challengeId).eq('action_id', actionId).eq('user_id', principal.authUserId).eq('customer_id', principal.customerId).eq('session_id', principal.sessionId).single();
        if (error || !challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= Date.now() || challenge.method !== settings.method || challenge.settings_version !== settings.version) throw new Error('Authorization challenge unavailable');
        const signatureVerified = settings.method === 'BIOMETRIC' && !!settings.publicKey && verifyDeviceSignature(settings.publicKey, challenge.payload, credentials.signature || '');
        const { data: accepted, error: commitError } = await this.database.rpc('authorize_preferred_action', { p_action_id: actionId, p_user_id: principal.authUserId, p_customer_id: principal.customerId, p_session_id: principal.sessionId, p_challenge_id: challenge.id, p_pin: settings.method === 'PIN' ? credentials.pin : null, p_signature_verified: signatureVerified });
        if (commitError || accepted !== true) throw new Error('Authorization failed. Check your method; five incorrect PIN attempts lock PIN authorization for 15 minutes.');
        const action = await this.repository.getById(actionId);
        if (!action) throw new Error('Action unavailable');
        return { action, session: {} };
    }
}
