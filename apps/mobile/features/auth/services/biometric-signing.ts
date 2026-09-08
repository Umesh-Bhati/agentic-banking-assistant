import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { ed25519 } from '@noble/curves/ed25519.js';

let promptActive = false;
export const isBankingBiometricPromptActive = () => promptActive;
const options: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'banking-authorization-signing',
  authenticationPrompt: 'Authorize this banking operation',
};
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const fromHex = (value: string) => Uint8Array.from(value.match(/.{2}/g) || [], byte => parseInt(byte, 16));
function keyName(customerId: string, publicKey: string) {
  if (!/^[\w-]+$/.test(customerId) || !/^[0-9a-f]{64}$/.test(publicKey)) throw new Error('Invalid device enrollment');
  return 'banking-key.' + customerId + '.' + publicKey;
}
async function biometricPrompt<T>(operation: () => Promise<T>): Promise<T> {
  if (promptActive) throw new Error('Biometric authorization already active');
  promptActive = true;
  try { return await operation(); } finally { promptActive = false; }
}
export async function enrollBiometricKey(customerId: string): Promise<string> {
  if (!SecureStore.canUseBiometricAuthentication()) throw new Error('Enroll Face ID or a fingerprint on this device first.');
  const secret = await getRandomBytesAsync(32);
  const publicKey = hex(ed25519.getPublicKey(secret));
  try {
    await biometricPrompt(async () => {
      await SecureStore.setItemAsync(keyName(customerId, publicKey), hex(secret), options);
      if (!await SecureStore.getItemAsync(keyName(customerId, publicKey), options)) throw new Error('Biometric enrollment failed');
    });
    return publicKey;
  } catch (error) {
    await SecureStore.deleteItemAsync(keyName(customerId, publicKey), options);
    throw error;
  } finally { secret.fill(0); }
}
export async function signBankingChallenge(customerId: string, publicKey: string, payload: string): Promise<string> {
  const stored = await biometricPrompt(() => SecureStore.getItemAsync(keyName(customerId, publicKey), options));
  if (!stored || !/^[0-9a-f]{64}$/.test(stored)) throw new Error('This device is not enrolled, or its biometrics changed. Re-enroll in Preferences.');
  const secret = fromHex(stored);
  try { return hex(ed25519.sign(new TextEncoder().encode(payload), secret)); }
  finally { secret.fill(0); }
}
export async function removeBiometricKey(customerId: string, publicKey: string) {
  await SecureStore.deleteItemAsync(keyName(customerId, publicKey), options);
}
