import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';

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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00838F',
    textAlign: 'center',
  },
  cardInfo: {
    backgroundColor: '#F0F7F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  cardType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00838F',
  },
  cardLast4: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  authOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  authOption: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  authOptionSelected: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#E0F2F1',
    borderWidth: 2,
    borderColor: '#00838F',
  },
  authOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pinContainer: {
    marginBottom: 16,
  },
  pinLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  pinInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  pinBox: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: '#00838F',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pinChar: {
    fontSize: 24,
    fontWeight: '600',
    color: '#00838F',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: 50,
    opacity: 0,
    zIndex: 10,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  submitButton: {
    backgroundColor: '#00838F',
  },
  buttonDisabled: {
    backgroundColor: '#B0D0CF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00838F',
  },
});