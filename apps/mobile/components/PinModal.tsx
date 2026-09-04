import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';

interface PinModalProps {
  visible: boolean;
  cardType: string;
  last4: string;
  onAuthSubmit: (pin: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  visible,
  cardType,
  last4,
  onAuthSubmit,
  onCancel,
  loading = false,
  error,
}) => {
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, [visible]);

  const handleSubmit = () => {
    if (pin.length === 4) {
      onAuthSubmit(pin);
    }
  };

  const handlePinChange = (text: string) => {
    if (/^\d*$/.test(text) && text.length <= 4) {
      setPin(text);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Authorize Card Block</Text>
          </View>
          
          <View style={styles.cardInfo}>
            <Text style={styles.cardType}>{cardType} Card</Text>
            <Text style={styles.cardLast4}>Ending in {last4}</Text>
          </View>

          <View style={styles.authOptions}>
            <TouchableOpacity style={styles.authOption} activeOpacity={0.7}>
              <Text style={styles.authOptionText}>🔐 Face ID</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.authOption} activeOpacity={0.7}>
              <Text style={styles.authOptionText}>👁️ Fingerprint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.authOptionSelected} activeOpacity={0.7}>
              <Text style={styles.authOptionText}>🔢 PIN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pinContainer}>
            <Text style={styles.pinLabel}>Enter 4-digit PIN</Text>
            <View style={styles.pinInputContainer}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.pinBox}>
                  <Text style={styles.pinChar}>{pin[i] ? '●' : ''}</Text>
                </View>
              ))}
            </View>
            <TextInput
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

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, pin.length !== 4 && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || pin.length !== 4}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Authorize</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
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
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
    textAlign: 'center',
  },
  cardInfo: {
    backgroundColor: Colors.accentSoft,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  cardType: {
    fontSize: Typography.bodyLarge.fontSize,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
  },
  cardLast4: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  authOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xl,
  },
  authOption: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  authOptionSelected: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentLight,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  authOptionText: {
    fontSize: 14,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  pinContainer: {
    marginBottom: Spacing.lg,
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
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  pinChar: {
    fontSize: 24,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: 50,
    opacity: 0,
    zIndex: 10,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  submitButton: {
    backgroundColor: Colors.accent,
  },
  buttonDisabled: {
    backgroundColor: Colors.disabledAccent,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
  },
});