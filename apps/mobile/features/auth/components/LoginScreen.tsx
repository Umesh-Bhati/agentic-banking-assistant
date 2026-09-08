import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Landmark, Mail, Lock, Eye, EyeOff, AlertCircle, ScanFace, LogIn } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';
import { SignupScreen } from './SignupScreen';

export function LoginScreen() {
  const { 
    email, 
    setEmail, 
    password, 
    setPassword, 
    handleLogin, 
    loginLoading, 
    loginError, 
    canUseBiometrics, 
    handleBiometricAuth 
  } = useChat();

  const [showPassword, setShowPassword] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  if (showSignup) {
    return <SignupScreen onBackToLogin={() => setShowSignup(false)} />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Landmark size={32} color={Colors.accent} />
          </View>
          <Text style={styles.logoText}>Al Masraf</Text>
          <Text style={styles.subtitle}>Digital Banking Assistant</Text>
        </View>

        {loginError ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color="#991B1B" style={styles.errorIcon} />
            <Text style={styles.errorText}>{loginError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                accessibilityLabel="Email address"
                testID="login-email"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={__DEV__ ? 'prashant@gmail.com' : 'name@example.com'}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                accessibilityLabel="Password"
                testID="login-password"
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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.textMuted} />
                ) : (
                  <Eye size={20} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {__DEV__ ? (
            <Text style={styles.demoCredentials}>
              Local demo: prashant@gmail.com / prashant123
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loginLoading}
            activeOpacity={0.8}
          >
            {loginLoading ? (
              <ActivityIndicator color={Colors.textLight} />
            ) : (
              <View style={styles.buttonContent}>
                <LogIn size={20} color={Colors.textLight} style={styles.buttonIcon} />
                <Text style={styles.loginButtonText}>Log In to Mobile Banking</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: Spacing.md }} onPress={() => setShowSignup(true)}>
            <Text style={{ color: Colors.accent, fontSize: 14, fontWeight: Typography.weight.semibold }}>Need an account? Bank enrollment</Text>
          </TouchableOpacity>

          {canUseBiometrics && handleBiometricAuth ? (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricAuth}
              activeOpacity={0.8}
            >
              <ScanFace size={20} color={Colors.accent} style={styles.buttonIcon} />
              <Text style={styles.biometricButtonText}>Quick Unlock with Face ID / Touch ID</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  demoCredentials: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: Spacing.xs,
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
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingVertical: 12,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.sm,
  },
  biometricButtonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: Typography.weight.semibold,
  },
});
