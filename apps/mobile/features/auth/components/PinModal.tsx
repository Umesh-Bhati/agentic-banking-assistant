import { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, Button, ActivityIndicator } from 'react-native';
import type { AuthPreference } from '@boit/shared-types';
import { json } from '../../../lib/api/client';
import { useChat } from '../../../context/ChatContext';
interface Props { visible: boolean; cardType: string; last4: string; onAuthSubmit: (code: string, factorId: string, method: AuthPreference) => void; onCancel: () => void; loading?: boolean; error?: string; }
export function PinModal({ visible, cardType, last4, onAuthSubmit, onCancel, loading, error }: Props) {
  const { authToken, checkActionStatus } = useChat();
  const [method, setMethod] = useState<AuthPreference | null>(null);
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [factorError, setFactorError] = useState('');
  useEffect(() => {
    setCode(''); setFactorId(''); setMethod(null); setFactorError('');
    if (!visible || !authToken) return;
    let current = true;
    void (async () => {
      const settings = await json<{ method: AuthPreference }>('/api/profile/authorization', authToken);
      if (!current) return;
      if (!['PIN', 'BIOMETRIC', 'TOTP'].includes(settings.method)) throw new Error('Unknown authorization method');
      setMethod(settings.method);
      if (settings.method === 'TOTP') {
        const { factors } = await json<{ factors: Array<{ id: string; status: string }> }>('/api/auth/mfa/factors', authToken);
        if (!current) return;
        const verified = factors.find(factor => factor.status === 'verified');
        setFactorId(verified?.id || '');
        if (!verified) setFactorError('Set up an authenticator or choose Banking PIN in Preferences. Cancel this operation to open Preferences.');
      }
    })().catch(() => { if (current) setFactorError('Unable to load your authorization preference. Try again.'); });
    return () => { current = false; };
  }, [visible, authToken]);
  const ready = !!method && !factorError && (method === 'BIOMETRIC' || (code.length === 6 && (method !== 'TOTP' || !!factorId)));
  return <Modal visible={visible} transparent onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}><View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Authorize banking operation</Text>
      <Text>{cardType}{last4 ? ' ending in ' + last4 : ''}</Text>
      {!method && !factorError && <ActivityIndicator />}
      {method && <Text>{method === 'PIN' ? 'Enter your six-digit banking PIN.' : method === 'BIOMETRIC' ? 'Use Face ID or your fingerprint on the device enrolled in Preferences.' : 'Enter the six-digit code from your authenticator.'} This confirmation expires after five minutes.</Text>}
      {method && method !== 'BIOMETRIC' && <TextInput accessibilityLabel={method === 'PIN' ? 'Banking PIN' : 'Authenticator code'} value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete={method === 'TOTP' ? 'one-time-code' : 'off'} secureTextEntry maxLength={6} style={{ borderWidth: 1, padding: 12 }} />}
      {!!(error || factorError) && <Text accessibilityRole="alert" style={{ color: '#991b1b' }}>{error || factorError}</Text>}
      {loading && <ActivityIndicator />}
      <Button title={method === 'BIOMETRIC' ? 'Authorize with biometrics' : 'Authorize'} disabled={loading || !ready} onPress={() => { if (method) onAuthSubmit(code, factorId, method); setCode(''); }} />
      <Button title="Check bank status" disabled={loading} onPress={checkActionStatus} />
      <Button title="Cancel operation" disabled={loading} onPress={onCancel} />
    </View></View>
  </Modal>;
}
