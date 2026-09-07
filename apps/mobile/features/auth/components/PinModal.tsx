import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { CreditCard, ScanFace, Fingerprint, KeyRound, ShieldCheck, XCircle, AlertCircle, Mail, Lock } from 'lucide-react-native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../../constants/theme';

export interface PinModalProps {
  visible: boolean;
  cardType: string;
  last4: string;
  onAuthSubmit: (data: string | { pin?: string; biometricToken?: string; email?: string; password?: string }) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
  authPreference?: 'PIN' | 'BIOMETRIC' | 'CREDENTIALS';
  userEmail?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  visible,
  cardType,
  last4,
  onAuthSubmit,
  onCancel,
  loading = false,
  error,
  authPreference,
  userEmail,
}) => {
  const [pin, setPin] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [supportedBiometrics, setSupportedBiometrics] = useState<LocalAuthentication.AuthenticationType[]>([]);
  const [authMode, setAuthMode] = useState<'PIN' | 'BIOMETRIC' | 'CREDENTIALS'>('PIN');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setCredPassword('');
      if (authPreference) {
        setAuthMode(authPreference);
        if (authPreference === 'BIOMETRIC') {
          handleBiometricAuth();
        }
      } else {
        setAuthMode('PIN');
      }
    }
  }, [visible, authPreference]);

  useEffect(() => {
    const checkBiometrics = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (hasHardware && isEnrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setSupportedBiometrics(types);
      }
    };
    checkBiometrics();
  }, []);

  const handleSubmit = () => {
    if (authMode === 'PIN' && pin.length === 4) {
      onAuthSubmit({ pin });
    } else if (authMode === 'CREDENTIALS' && credPassword.length > 0) {
      onAuthSubmit({ email: userEmail, password: credPassword });
    }
  };

  const handlePinChange = (text: string) => {
    if (/^\d*$/.test(text) && text.length <= 4) {
      setPin(text);
    }
  };

  const handleBiometricAuth = async () => {
    setAuthMode('BIOMETRIC');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to block your ${cardType} card ending in ${last4}`,
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        onAuthSubmit({ biometricToken: `bio_verified_${Date.now()}` });
      } else {
        if (!authPreference) setAuthMode('PIN');
      }
    } catch (err) {
      console.warn('Biometric auth error:', err);
      if (!authPreference) setAuthMode('PIN');
    }
  };

  if (!visible) return null;

  const hasFaceId = supportedBiometrics.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = supportedBiometrics.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) || 
                         supportedBiometrics.includes(LocalAuthentication.AuthenticationType.IRIS);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <View style={styles.headerIconBadge}>
                <ShieldCheck size={28} color={Colors.accent} />
              </View>
              <Text style={styles.title}>Authorize Card Block</Text>
            </View>
            
            <View style={styles.cardInfo}>
              <CreditCard size={24} color={Colors.accent} style={styles.cardIcon} />
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardType}>{cardType} Card</Text>
                <Text style={styles.cardLast4}>Ending in •••• {last4}</Text>
              </View>
            </View>

            {!authPreference && (
              <View style={styles.authOptions}>
                {hasFaceId && (
                  <TouchableOpacity 
                    style={authMode === 'BIOMETRIC' ? styles.authOptionSelected : styles.authOption} 
                    activeOpacity={0.7}
                    onPress={handleBiometricAuth}
                  >
                    <ScanFace size={18} color={authMode === 'BIOMETRIC' ? Colors.accent : Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={authMode === 'BIOMETRIC' ? styles.authOptionTextSelected : styles.authOptionText}>Face ID</Text>
                  </TouchableOpacity>
                )}
                {hasFingerprint && !hasFaceId && (
                  <TouchableOpacity 
                    style={authMode === 'BIOMETRIC' ? styles.authOptionSelected : styles.authOption} 
                    activeOpacity={0.7}
                    onPress={handleBiometricAuth}
                  >
                    <Fingerprint size={18} color={authMode === 'BIOMETRIC' ? Colors.accent : Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={authMode === 'BIOMETRIC' ? styles.authOptionTextSelected : styles.authOptionText}>Biometrics</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={authMode === 'PIN' ? styles.authOptionSelected : styles.authOption} 
                  activeOpacity={0.7}
                  onPress={() => {
                    setAuthMode('PIN');
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                >
                  <KeyRound size={18} color={authMode === 'PIN' ? Colors.accent : Colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={authMode === 'PIN' ? styles.authOptionTextSelected : styles.authOptionText}>Passcode</Text>
                </TouchableOpacity>
              </View>
            )}

            {authMode === 'PIN' && (
              <View style={styles.pinContainer}>
                <Text style={styles.pinLabel}>Enter 4-digit App Passcode</Text>
                
                <Pressable onPress={() => inputRef.current?.focus()} style={styles.pinInputContainer}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.pinBox, pin.length === i && styles.pinBoxFocused]}>
                      <Text style={styles.pinChar}>{pin[i] ? '●' : ''}</Text>
                    </View>
                  ))}
                </Pressable>

                <TextInput
                  ref={inputRef}
                  style={styles.hiddenInput}
                  value={pin}
                  onChangeText={handlePinChange}
                  maxLength={4}
                  keyboardType="numeric"
                  autoFocus={true}
                  placeholder=" "
                  secureTextEntry={true}
                />
              </View>
            )}

            {authMode === 'BIOMETRIC' && (
              <TouchableOpacity style={styles.biometricPromptContainer} onPress={handleBiometricAuth}>
                <ScanFace size={36} color={Colors.accent} style={{ marginBottom: 8 }} />
                <Text style={styles.biometricPromptText}>Tap to authenticate using Biometrics</Text>
              </TouchableOpacity>
            )}

            {authMode === 'CREDENTIALS' && (
              <View style={styles.credentialsContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: Colors.textSecondary }]}
                      value={userEmail}
                      editable={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={credPassword}
                      onChangeText={setCredPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
              </View>
            )}

            {error ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#991B1B" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={loading}
                activeOpacity={0.8}
              >
                <XCircle size={18} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              {authMode !== 'BIOMETRIC' && (
                <TouchableOpacity
                  style={[
                    styles.button, 
                    styles.submitButton, 
                    ((authMode === 'PIN' && pin.length !== 4) || (authMode === 'CREDENTIALS' && !credPassword)) && styles.buttonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || (authMode === 'PIN' && pin.length !== 4) || (authMode === 'CREDENTIALS' && !credPassword)}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.textLight} />
                  ) : (
                    <>
                      <ShieldCheck size={18} color={Colors.textLight} style={{ marginRight: 6 }} />
                      <Text style={styles.submitButtonText}>Authorize</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    maxWidth: 400,
    width: '100%',
    ...Shadows.modal,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
    textAlign: 'center',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentSoft,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  cardIcon: {
    marginRight: Spacing.md,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardType: {
    fontSize: Typography.bodyLarge.fontSize,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
  },
  cardLast4: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  authOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  authOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  authOptionSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  authOptionText: {
    fontSize: 14,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  authOptionTextSelected: {
    fontSize: 14,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
  },
  pinContainer: {
    marginBottom: Spacing.lg,
  },
  biometricPromptContainer: {
    marginBottom: Spacing.lg,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  biometricPromptText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pinLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  pinInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pinBox: {
    width: 48,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  pinBoxFocused: {
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  pinChar: {
    fontSize: 22,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: 50,
    opacity: 0,
    zIndex: 10,
  },
  credentialsContainer: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    fontWeight: Typography.weight.medium,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: BorderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 46,
  },
  cancelButton: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  submitButton: {
    backgroundColor: Colors.accent,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: Typography.weight.semibold,
    color: Colors.textLight,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});