import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { AuthPreference } from '@boit/shared-types';
import { useChat } from '../../../context/ChatContext';
import { json } from '../../../lib/api/client';
import { useTheme } from '../../../hooks/use-theme';
import type { Session } from '../../auth/services/session';
import { enrollBiometricKey, removeBiometricKey } from '../../auth/services/biometric-signing';
interface Enrollment { id: string; totp: { secret: string; uri: string; qr_code: string }; }
const choices = [
  { method: 'PIN' as const, title: 'Banking PIN', description: 'Authorize with a six-digit PIN you set here.' },
  { method: 'BIOMETRIC' as const, title: 'Biometrics', description: 'Authorize with Face ID or fingerprint on this device.' },
  { method: 'TOTP' as const, title: 'Authenticator code', description: 'Use a current code from your authenticator app.' },
];
export function PreferencesScreen({ visible, onClose, required = false }: { visible: boolean; onClose: () => void; required?: boolean }) {
  const { authToken, userProfile, applySession, fetchProfile } = useChat();
  const { colors } = useTheme();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [method, setMethod] = useState<AuthPreference | null>(required ? null : userProfile?.auth_preference || 'TOTP');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [repeatPin, setRepeatPin] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const [pendingFactors, setPendingFactors] = useState<Array<{ id: string; friendly_name?: string }>>([]);
  useEffect(() => {
    if (!visible || !authToken) return;
    let current = true; setLoadingFactors(true);
    void json<{ factors: Array<{ id: string; status: string; friendly_name?: string }> }>('/api/auth/mfa/factors', authToken).then(({ factors }) => {
      if (current) { setPendingFactors(factors.filter(factor => factor.status === 'unverified')); setVerified(factors.some(factor => factor.status === 'verified')); }
    }).catch(() => { if (current) setError('Unable to load authenticator enrollment. Try again.'); }).finally(() => { if (current) setLoadingFactors(false); });
    return () => { current = false; };
  }, [visible, authToken]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save preferences'); }
    finally { setBusy(false); setPassword(''); setPin(''); setRepeatPin(''); }
  };
  const enroll = () => run(async () => {
    if (!authToken || !password) throw new Error('Enter your account password');
    setEnrollment(await json<Enrollment>('/api/auth/mfa/enroll', authToken, { password }));
  });
  const verify = () => run(async () => {
    if (!authToken || !enrollment) return;
    const session = await json<Session>('/api/auth/mfa/verify-enrollment', authToken, { factorId: enrollment.id, code });
    await applySession(session, authToken); setEnrollment(null); setCode(''); setVerified(true); setPendingFactors([]);
    setNotice('Authenticator verified. Enter your password and save to select this method.');
  });
  const save = () => run(async () => {
    if (!method) throw new Error('Choose an authorization method');
    if (!authToken || !userProfile || !password) throw new Error('Enter your account password');
    if (method === 'PIN' && (pin.length !== 6 || pin !== repeatPin)) throw new Error('Enter matching six-digit PINs');
    if (method === 'TOTP' && !verified) throw new Error('Enroll and verify an authenticator first');
    let publicKey: string | undefined;
    try {
      if (method === 'BIOMETRIC') publicKey = await enrollBiometricKey(userProfile.id);
      if (!mounted.current) throw new Error('Session changed; sign in again');
      await json('/api/profile/preferences', authToken, { authPreference: method, password, ...(method === 'PIN' ? { pin } : {}), ...(publicKey ? { publicKey } : {}) }, 'PATCH');
    } catch (reason) {
      if (publicKey) await removeBiometricKey(userProfile.id, publicKey);
      throw reason;
    }
    await fetchProfile(); setNotice('Authorization preference saved. New approvals will use ' + choices.find(choice => choice.method === method)?.title + '.');
  });
  const inputStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.foreground };
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
    <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground }}>{required ? 'Set up banking authorization' : 'Preferences'}</Text>
    <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Authorization method</Text>
    <Text style={{ color: colors.mutedForeground }}>{required ? 'Before using the assistant, choose and set up how you will approve card blocks and statement fees.' : 'Current method: ' + (choices.find(choice => choice.method === userProfile?.auth_preference)?.title || 'Not configured') + '.'}</Text>
    {choices.map(choice => <Pressable key={choice.method} accessibilityRole="radio" accessibilityState={{ checked: method === choice.method, disabled: busy }} disabled={busy} onPress={() => { setMethod(choice.method); setError(''); setNotice(''); setPin(''); setRepeatPin(''); }} style={{ borderWidth: 1, borderColor: method === choice.method ? colors.primary : colors.border, backgroundColor: method === choice.method ? colors.muted : colors.background, borderRadius: 12, padding: 16, gap: 6 }}>
      <Text style={{ color: colors.foreground, fontWeight: '600' }}>{method === choice.method ? '● ' : '○ '}{choice.title}</Text>
      <Text style={{ color: colors.mutedForeground }}>{choice.description}</Text>
    </Pressable>)}
    <Text style={{ color: colors.foreground }}>Confirm your account password to set up or change authorization.</Text>
    <TextInput accessibilityLabel="Confirm account password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} style={inputStyle} />
    {method === 'PIN' && <View style={{ gap: 12 }}>
      <Text style={{ color: colors.foreground }}>Set a six-digit banking PIN. Five incorrect attempts lock PIN authorization for 15 minutes.</Text>
      <TextInput accessibilityLabel="New banking PIN" placeholder="New six-digit PIN" value={pin} onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, 6))} editable={!busy} secureTextEntry keyboardType="number-pad" maxLength={6} style={inputStyle} />
      <TextInput accessibilityLabel="Confirm banking PIN" placeholder="Confirm PIN" value={repeatPin} onChangeText={value => setRepeatPin(value.replace(/\D/g, '').slice(0, 6))} editable={!busy} secureTextEntry keyboardType="number-pad" maxLength={6} style={inputStyle} />
    </View>}
    {method === 'BIOMETRIC' && <Text style={{ color: colors.mutedForeground }}>Saving enrolls this device and replaces any previously enrolled biometric device. Your device must have Face ID or fingerprints configured.</Text>}
    {method === 'TOTP' && <View style={{ gap: 12 }}>
      {loadingFactors ? <ActivityIndicator /> : verified ? <Text>Authenticator already enrolled. Use codes from the app where it was set up, or choose another method above.</Text> : <>
        {!enrollment && pendingFactors.map(factor => <Button key={factor.id} title="Resume authenticator setup" onPress={() => setEnrollment({ id: factor.id, totp: { secret: '', uri: '', qr_code: '' } })} />)}
        {!enrollment && pendingFactors.length === 0 && <Button title="Enroll authenticator" disabled={busy || !password} onPress={enroll} />}
        {enrollment && <>
          <Text>{enrollment.totp.secret ? 'Add this setup key to your authenticator app. Keep it private.' : 'Enter a code from the authenticator you previously set up.'}</Text>
          {!!enrollment.totp.secret && <Text selectable>{enrollment.totp.secret}</Text>}
          <TextInput accessibilityLabel="Enrollment code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} secureTextEntry keyboardType="number-pad" maxLength={6} style={inputStyle} />
          <Button title="Verify enrollment" onPress={verify} disabled={busy || code.length !== 6} />
        </>}
      </>}
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text>}
    {!!notice && <Text accessibilityRole="alert" style={{ color: colors.primary }}>{notice}</Text>}
    {busy && <ActivityIndicator />}
    <Button title="Save authorization preference" onPress={save} disabled={busy || !method || !password || (method === 'PIN' && (pin.length !== 6 || pin !== repeatPin)) || (method === 'TOTP' && (!verified || loadingFactors))} />
    <Button title={required ? "Sign out" : "Close"} onPress={onClose} disabled={busy} />
  </ScrollView></SafeAreaView></SafeAreaProvider>;
}
