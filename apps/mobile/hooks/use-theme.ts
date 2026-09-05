import { Colors } from '../constants/theme';

export function useTheme() {
  return {
    colors: {
      background: Colors.background,
      foreground: Colors.textPrimary,
      muted: Colors.surfaceAlt,
      mutedForeground: Colors.textMuted,
      border: Colors.border,
      primary: Colors.primary,
      primaryForeground: Colors.textLight,
      secondary: Colors.surface,
      secondaryForeground: Colors.textSecondary,
      composer: Colors.composer,
      destructiveSurface: Colors.destructiveSurface,
      destructive: Colors.destructive,
    }
  };
}
