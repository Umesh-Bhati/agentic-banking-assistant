import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { KeyRound, ScanFace, Key, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';

interface PreferencesScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function PreferencesScreen({ visible, onClose }: PreferencesScreenProps) {
  const { userProfile, updateAuthPreference } = useChat();
  
  const [selectedPref, setSelectedPref] = useState<'PIN' | 'BIOMETRIC' | 'CREDENTIALS'>('PIN');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible && userProfile) {
      setSelectedPref((userProfile.auth_preference as any) || 'PIN');
      setPin('');
      setSuccess(false);
    }
  }, [visible, userProfile]);

  const handleSave = async () => {
    setSaving(true);
    await updateAuthPreference(selectedPref);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction Authorization</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Select Default Authorization Method</Text>
          <Text style={styles.sectionDesc}>Choose how you want to authorize sensitive transactions like blocking a card.</Text>

          <View style={styles.prefList}>
            <TouchableOpacity 
              style={[styles.prefCard, selectedPref === 'PIN' && styles.prefCardSelected]}
              onPress={() => setSelectedPref('PIN')}
            >
              <View style={styles.prefIconContainer}>
                <KeyRound size={24} color={selectedPref === 'PIN' ? Colors.accent : Colors.textMuted} />
              </View>
              <View style={styles.prefTextContainer}>
                <Text style={selectedPref === 'PIN' ? styles.prefTitleSelected : styles.prefTitle}>PIN Passcode</Text>
                <Text style={styles.prefDesc}>Use a 4-digit PIN</Text>
              </View>
              {selectedPref === 'PIN' && <CheckCircle2 size={24} color={Colors.accent} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.prefCard, selectedPref === 'BIOMETRIC' && styles.prefCardSelected]}
              onPress={() => setSelectedPref('BIOMETRIC')}
            >
              <View style={styles.prefIconContainer}>
                <ScanFace size={24} color={selectedPref === 'BIOMETRIC' ? Colors.accent : Colors.textMuted} />
              </View>
              <View style={styles.prefTextContainer}>
                <Text style={selectedPref === 'BIOMETRIC' ? styles.prefTitleSelected : styles.prefTitle}>Biometric</Text>
                <Text style={styles.prefDesc}>Use Face ID or Touch ID</Text>
              </View>
              {selectedPref === 'BIOMETRIC' && <CheckCircle2 size={24} color={Colors.accent} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.prefCard, selectedPref === 'CREDENTIALS' && styles.prefCardSelected]}
              onPress={() => setSelectedPref('CREDENTIALS')}
            >
              <View style={styles.prefIconContainer}>
                <Key size={24} color={selectedPref === 'CREDENTIALS' ? Colors.accent : Colors.textMuted} />
              </View>
              <View style={styles.prefTextContainer}>
                <Text style={selectedPref === 'CREDENTIALS' ? styles.prefTitleSelected : styles.prefTitle}>Account Credentials</Text>
                <Text style={styles.prefDesc}>Use email and password</Text>
              </View>
              {selectedPref === 'CREDENTIALS' && <CheckCircle2 size={24} color={Colors.accent} />}
            </TouchableOpacity>
          </View>

          {selectedPref === 'PIN' && (
            <View style={styles.pinSection}>
              <Text style={styles.pinLabel}>Update 4-Digit PIN</Text>
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
              <Text style={styles.pinHint}>Leave blank to keep your current PIN.</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textLight} />
            ) : success ? (
              <>
                <CheckCircle2 size={20} color={Colors.textLight} style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Saved!</Text>
              </>
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  prefList: {
    gap: Spacing.md,
  },
  prefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  prefCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  prefIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prefTextContainer: {
    flex: 1,
  },
  prefTitle: {
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  prefTitleSelected: {
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent,
  },
  prefDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pinSection: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pinLabel: {
    fontSize: 14,
    fontWeight: Typography.weight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
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
  pinHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: BorderRadius.pill,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
  },
});
