import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { User, Settings, LogOut, X } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';
import { PreferencesScreen } from './PreferencesScreen';

export function ProfileMenu() {
  const { userProfile, handleLogout } = useChat();
  const [menuVisible, setMenuVisible] = useState(false);
  const [preferencesVisible, setPreferencesVisible] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Profile menu"
        style={styles.avatarButton}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.avatarText}>{getInitials(userProfile?.full_name)}</Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible || preferencesVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setMenuVisible(false); setPreferencesVisible(false); }}
      >
        {preferencesVisible ? <PreferencesScreen visible onClose={() => setPreferencesVisible(false)} /> : <Pressable
          accessible={false}
          style={styles.overlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable accessible={false} style={styles.menuContainer}>
            <View style={styles.header}>
              <View style={styles.headerInfo}>
                <View style={styles.largeAvatar}>
                  <Text style={styles.largeAvatarText}>{getInitials(userProfile?.full_name)}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{userProfile?.full_name || 'User'}</Text>
                  <Text style={styles.userEmail}>{userProfile?.email || ''}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuItems}>
              <TouchableOpacity
                accessibilityLabel="Preferences"
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setPreferencesVisible(true);
                }}
              >
                <Settings size={20} color={Colors.textPrimary} style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Preferences</Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Logout"
                style={[styles.menuItem, styles.logoutItem]}
                onPress={() => {
                  setMenuVisible(false);
                  handleLogout();
                }}
              >
                <LogOut size={20} color={Colors.error} style={styles.menuIcon} />
                <Text style={[styles.menuItemText, { color: Colors.error }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.background,
    width: 300,
    marginTop: 60,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  largeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  largeAvatarText: {
    fontSize: 18,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
  },
  userName: {
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuItems: {
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  menuIcon: {
    marginRight: Spacing.md,
  },
  menuItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  },
  logoutItem: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
  },
});
