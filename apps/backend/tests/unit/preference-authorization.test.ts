import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { verifyDeviceSignature, PreferenceAuthorizationService } from '../../src/services/actions/preference-authorization.service.js';
import { principal, query } from '../helpers/database.js';

describe('device proof verification', () => {
  const key = generateKeyPairSync('ed25519');
  const publicKey = key.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const payload = JSON.stringify({ actionId: 'one', sessionId: 'session', nonce: 'one-time' });
  const signature = sign(null, Buffer.from(payload), key.privateKey).toString('hex');
  it('accepts the enrolled key signature and rejects a changed action, nonce or signature', () => {
    expect(verifyDeviceSignature(publicKey, payload, signature)).toBe(true);
    expect(verifyDeviceSignature(publicKey, payload.replace('one-time', 'another'), signature)).toBe(false);
    expect(verifyDeviceSignature(publicKey, payload.replace('one"', 'two"'), signature)).toBe(false);
    expect(verifyDeviceSignature(publicKey, payload, 'bio_verified')).toBe(false);
    expect(verifyDeviceSignature('00'.repeat(32), payload, signature)).toBe(false);
  });
});
describe('preferred authorization challenge checks', () => {
  it.each([
    { consumed_at: '2026-01-01' },
    { expires_at: '2020-01-01' },
    { method: 'BIOMETRIC' },
    { settings_version: 1 },
  ])('rejects stale or mismatched proof before committing: %j', async override => {
    const rpc = vi.fn();
    const database = { rpc, from: (table: string) => query({ data: table === 'customer_profiles' ? { auth_preference: 'PIN' } : table === 'banking_authorization_settings' ? { version: 2 } : { method: 'PIN', settings_version: 2, expires_at: new Date(Date.now() + 60000).toISOString(), ...override }, error: null }) };
    const service = new PreferenceAuthorizationService(database as any, {} as any);
    await expect(service.authorize('action', principal, { challengeId: 'challenge', pin: '123456' })).rejects.toThrow('unavailable');
    expect(rpc).not.toHaveBeenCalled();
  });
});
