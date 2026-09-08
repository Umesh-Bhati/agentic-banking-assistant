import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { json } from '../../../lib/api/client';
export interface Session { token: string; refreshToken: string; expiresAt: number; }
const KEY = 'banking_session_v2';
export async function saveSession(session: Session) {
  if (!session.token || !session.refreshToken || !Number.isFinite(session.expiresAt)) throw new Error('Invalid server session');
  if (Platform.OS === 'web') return; // Browser sessions remain in memory only.
  await SecureStore.setItemAsync(KEY, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function clearSession() {
  if (Platform.OS === 'web') return;
  await Promise.all([KEY, 'almasraf_auth_token', 'almasraf_logged_in'].map(key => SecureStore.deleteItemAsync(key)));
}
export async function restoreSession(): Promise<Session | null> {
  if (Platform.OS === 'web') return null;
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Session;
    if (!saved.refreshToken) throw new Error('Invalid session');
    // Revalidate every unlock, including revocation; never trust local logged-in flags.
    const fresh = await json<Session>('/api/auth/refresh', null, { refreshToken: saved.refreshToken });
    await saveSession(fresh);
    return fresh;
  } catch { await clearSession(); return null; }
}
