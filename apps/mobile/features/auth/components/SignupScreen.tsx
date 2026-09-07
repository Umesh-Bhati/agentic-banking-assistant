import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Landmark, Mail, Lock, Eye, EyeOff, AlertCircle, UserPlus, Phone, KeyRound, ScanFace, Key } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';

export function SignupScreen({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { handleSignup, loginLoading, loginError } = useChat();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [authPreference, setAuthPreference] = useState<'PIN' | 'BIOMETRIC' | 'CREDENTIALS'>('PIN');
  const [pin, setPin] = useState('');

  const onSubmit = () => {
    handleSignup({
      fullName,
      email,
      phone,
      password,
      authPreference,
      pin: authPreference === 'PIN' ? pin : undefined,
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <UserPlus size={32} color={Colors.accent} />
            </View>
            <Text style={styles.logoText}>Create Account</Text>
            <Text style={styles.subtitle}>Join Al Masraf Digital Banking</Text>
          </View>

          {loginError ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color="#991B1B" style={styles.errorIcon} />
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <UserPlus size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="john@example.com"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Phone size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+1 234 567 8900"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.textMuted} />
                  ) : (
                    <Eye size={20} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Auth Preference</Text>
            <View style={styles.prefRow}>
              <TouchableOpacity 
                style={[styles.prefCard, authPreference === 'PIN' && styles.prefCardSelected]}
                onPress={() => setAuthPreference('PIN')}
              >
                <KeyRound size={24} color={authPreference === 'PIN' ? Colors.accent : Colors.textMuted} />
                <Text style={authPreference === 'PIN' ? styles.prefTextSelected : styles.prefText}>PIN</Text>
                <Text style={styles.prefDesc}>4-digit passcode</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.prefCard, authPreference === 'BIOMETRIC' && styles.prefCardSelected]}
                onPress={() => setAuthPreference('BIOMETRIC')}
              >
                <ScanFace size={24} color={authPreference === 'BIOMETRIC' ? Colors.accent : Colors.textMuted} />
                <Text style={authPreference === 'BIOMETRIC' ? styles.prefTextSelected : styles.prefText}>Biometric</Text>
                <Text style={styles.prefDesc}>Face ID / Touch ID</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.prefCard, authPreference === 'CREDENTIALS' && styles.prefCardSelected]}
                onPress={() => setAuthPreference('CREDENTIALS')}
              >
                <Key size={24} color={authPreference === 'CREDENTIALS' ? Colors.accent : Colors.textMuted} />
                <Text style={authPreference === 'CREDENTIALS' ? styles.prefTextSelected : styles.prefText}>Credentials</Text>
                <Text style={styles.prefDesc}>Email & password</Text>
              </TouchableOpacity>
            </View>

            {authPreference === 'PIN' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>4-Digit PIN</Text>
                <View style={styles.inputWrapper}>
                  <KeyRound size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={pin}
                    onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    placeholder="••••"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]}
              onPress={onSubmit}
              disabled={loginLoading}
              activeOpacity={0.8}
            >
              {loginLoading ? (
                <ActivityIndicator color={Colors.textLight} />
              ) : (
                <Text style={styles.loginButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={onBackToLogin}
            >
              <Text style={styles.linkButtonText}>Already have an account? Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.background,
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoText: {
    fontSize: 26,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: Typography.weight.medium,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  prefCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
    marginHorizontal: Spacing.xs / 2,
  },
  prefCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  prefText: {
    fontSize: 12,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  prefTextSelected: {
    fontSize: 12,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  prefDesc: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  loginButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  linkButtonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: Typography.weight.semibold,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorIcon: {
    marginRight: Spacing.xs,
  },
  errorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 14,
    fontWeight: Typography.weight.medium,
  },
});
