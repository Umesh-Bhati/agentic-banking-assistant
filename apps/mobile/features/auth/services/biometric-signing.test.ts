import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPublicKey, verify } from 'node:crypto';
const state = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn(), supported: vi.fn() }));
vi.mock('expo-secure-store', () => ({ getItemAsync: state.get, setItemAsync: state.set, deleteItemAsync: state.remove, canUseBiometricAuthentication: state.supported, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1 }));
vi.mock('expo-crypto', () => ({ getRandomBytesAsync: async () => new Uint8Array(32).fill(7) }));
import { enrollBiometricKey, signBankingChallenge, isBankingBiometricPromptActive } from './biometric-signing';
beforeEach(() => { vi.clearAllMocks(); state.supported.mockReturnValue(true); state.get.mockResolvedValue('07'.repeat(32)); });
describe('biometric-protected signing', () => {
  it('stores a device-only protected key and signs a payload verifiable by the backend', async () => {
    const publicKey = await enrollBiometricKey('customer');
    expect(state.set.mock.calls[0][2]).toMatchObject({ requireAuthentication: true, keychainAccessible: 1 });
    const signature = await signBankingChallenge('customer', publicKey, 'bank challenge');
    const key = createPublicKey({ key: Buffer.from('302a300506032b6570032100' + publicKey, 'hex'), format: 'der', type: 'spki' });
    expect(verify(null, Buffer.from('bank challenge'), key, Buffer.from(signature, 'hex'))).toBe(true);
    expect(verify(null, Buffer.from('other challenge'), key, Buffer.from(signature, 'hex'))).toBe(false);
    expect(isBankingBiometricPromptActive()).toBe(false);
  });
  it('does not sign when the biometric prompt is cancelled or the key is invalidated', async () => {
    state.get.mockRejectedValueOnce(new Error('Cancelled'));
    await expect(signBankingChallenge('customer', 'ab'.repeat(32), 'challenge')).rejects.toThrow('Cancelled');
    expect(isBankingBiometricPromptActive()).toBe(false);
    state.get.mockResolvedValueOnce(null);
    await expect(signBankingChallenge('customer', 'ab'.repeat(32), 'challenge')).rejects.toThrow('not enrolled');
  });
});
