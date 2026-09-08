import { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, Button, ActivityIndicator } from 'react-native';
import { json } from '../../../lib/api/client';
import { useChat } from '../../../context/ChatContext';
interface Props { visible: boolean; cardType: string; last4: string; onAuthSubmit: (code: string, factorId: string) => void; onCancel: () => void; loading?: boolean; error?: string; }
export function PinModal({ visible, cardType, last4, onAuthSubmit, onCancel, loading, error }: Props) {
  const { authToken, checkActionStatus } = useChat();
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string }>>([]);
  const [factorError, setFactorError] = useState('');
  useEffect(() => {
    setCode(''); setFactorId(''); setFactors([]); setFactorError('');
    if (!visible || !authToken) return;
    let current = true;
    void json<{ factors: Array<{ id: string; status: string; friendly_name?: string }> }>('/api/auth/mfa/factors', authToken).then(({ factors }) => {
      if (!current) return;
      const verified = factors.filter(factor => factor.status === 'verified'); setFactors(verified); setFactorId(verified[0]?.id || '');
      if (!verified.length) setFactorError('Enroll an authenticator in Preferences before authorizing this operation. Cancel this operation to open Preferences.');
    }).catch(() => { if (current) setFactorError('Unable to load authenticators. Sign in again or try later.'); });
    return () => { current = false; };
  }, [visible, authToken]);
  return <Modal visible={visible} transparent onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}><View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Authorize banking operation</Text>
      <Text>{cardType}{last4 ? ' ending in ' + last4 : ''}</Text>
      <Text>Enter the six-digit code from your authenticator. This confirmation expires after five minutes.</Text>
      {factors.length > 1 && factors.map(factor => <Button key={factor.id} title={(factorId === factor.id ? 'Selected: ' : '') + (factor.friendly_name || 'Authenticator')} onPress={() => setFactorId(factor.id)} />)}
      <TextInput accessibilityLabel="Authenticator code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" secureTextEntry maxLength={6} style={{ borderWidth: 1, padding: 12 }} />
      {!!(error || factorError) && <Text accessibilityRole="alert" style={{ color: '#991b1b' }}>{error || factorError}</Text>}
      {loading && <ActivityIndicator />}
      <Button title="Authorize" disabled={loading || code.length !== 6 || !factorId} onPress={() => { onAuthSubmit(code, factorId); setCode(''); }} />
      <Button title="Check bank status" disabled={loading} onPress={checkActionStatus} />
      <Button title="Cancel operation" disabled={loading} onPress={onCancel} />
    </View></View>
  </Modal>;
}
