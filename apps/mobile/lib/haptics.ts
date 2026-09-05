import * as ExpoHaptics from 'expo-haptics';

export const haptics = {
  selection: () => ExpoHaptics.selectionAsync(),
  light: () => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light),
  medium: () => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium),
  heavy: () => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy),
  success: () => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success),
};
