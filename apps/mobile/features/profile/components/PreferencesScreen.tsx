import { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../../context/ChatContext';
import { json } from '../../../lib/api/client';
import type { Session } from '../../auth/services/session';
interface Enrollment { id: string; totp: { secret: string; uri: string; qr_code: string }; }
export function PreferencesScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { authToken, applySession } = useChat();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [enrollmentPassword, setEnrollmentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [pendingFactors, setPendingFactors] = useState<Array<{ id: string; friendly_name?: string }>>([]);
  useEffect(() => {
    setEnrollment(null); setCode(''); setEnrollmentPassword(''); setError(''); setVerified(false); setPendingFactors([]);
    if (!visible || !authToken) return;
    let current = true;
    void json<{ factors: Array<{ id: string; status: string; friendly_name?: string }> }>('/api/auth/mfa/factors', authToken).then(({ factors }) => {
      if (current) { setPendingFactors(factors.filter(factor => factor.status === 'unverified')); setVerified(factors.some(factor => factor.status === 'verified')); }
    }).catch(() => { if (current) setError('Unable to load pending enrollment. Try again after sign-in.'); });
    return () => { current = false; };
  }, [visible, authToken]);
  const enroll = async () => {
    if (!authToken || !enrollmentPassword) return; setBusy(true); setError('');
    const password = enrollmentPassword; setEnrollmentPassword('');
    try { setEnrollment(await json<Enrollment>('/api/auth/mfa/enroll', authToken, { password })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Enrollment failed'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (!authToken || !enrollment) return; setBusy(true); setError('');
    try {
      const session = await json<Session>('/api/auth/mfa/verify-enrollment', authToken, { factorId: enrollment.id, code });
      await applySession(session, authToken); setEnrollment(null); setCode(''); setVerified(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Verification failed'); }
    finally { setBusy(false); }
  };
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}><ScrollView contentContainerStyle={{ padding: 28, gap: 20 }}>
    <Text style={{ fontSize: 22, fontWeight: '700' }}>Banking security</Text>
    <Text>Sensitive operations require an authenticator code verified by the bank. Face ID or fingerprint only unlocks this app.</Text>
    <Text>If you lose your authenticator, contact bank support for identity recovery.</Text>
    {!enrollment && pendingFactors.map(factor => <Button key={factor.id} title={'Resume enrollment: ' + (factor.friendly_name || 'Authenticator')} onPress={() => setEnrollment({ id: factor.id, totp: { secret: '', uri: '', qr_code: '' } })} />)}
    {!enrollment && !verified && <View style={{ gap: 12 }}><Text>Confirm your account password to enroll an authenticator.</Text><TextInput accessibilityLabel="Confirm account password" value={enrollmentPassword} onChangeText={setEnrollmentPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ borderWidth: 1, padding: 12 }} /><Button title="Enroll authenticator" disabled={busy || !enrollmentPassword} onPress={enroll} /></View>}
    {enrollment && <View style={{ gap: 16 }}>{enrollment.totp.secret ? <><Text>Enter this setup key into your authenticator app. Keep it private. You can resume verification here after returning to the bank app.</Text><Text selectable>{enrollment.totp.secret}</Text></> : <Text>Enter a code from the authenticator you previously set up.</Text>}<TextInput accessibilityLabel="Enrollment code" value={code} onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))} secureTextEntry keyboardType="number-pad" maxLength={6} style={{ borderWidth: 1, padding: 12 }} /><Button title="Verify enrollment" onPress={verify} disabled={busy || code.length !== 6} /></View>}
    {verified && <Text>Authenticator verified successfully.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#991b1b' }}>{error}</Text>}
    {busy && <ActivityIndicator />}
    <Button title="Close" onPress={onClose} disabled={busy} />
  </ScrollView></SafeAreaView></SafeAreaProvider>;
}
