export const Colors = {
  // Brand colors
  primary: '#364b65',
  primaryLight: '#4b6584',
  primaryDark: '#273747',
  accent: '#00838F',
  accentLight: '#E0F2F1',
  accentSoft: '#F0F7F7',

  // System & Neutral
  background: '#FFFFFF',
  surface: '#FAFAFA',
  surfaceAlt: '#F5F5F5',
  border: '#E0E0E0',
  borderDark: '#DDDDDD',
  composer: '#FFFFFF',
  destructiveSurface: '#FFEBEE',
  destructive: '#D32F2F',

  // Text
  textPrimary: '#333333',
  textSecondary: '#666666',
  textMuted: '#888888',
  textLight: '#FFFFFF',
  textBrand: '#364b65',
  textAccent: '#00838F',

  // Chat Bubbles
  userBubble: '#364b65',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#F0F0F0',
  assistantBubbleText: '#333333',

  // Status
  error: '#D32F2F',
  success: '#2E7D32',
  warning: '#ED6C02',
  disabled: '#B0B0B0',
  disabledAccent: '#B0D0CF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  threadMaxWidth: 800,
};

export const Typography = {
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  header: {
    fontSize: 26,
    lineHeight: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 24,
  full: 9999,
  composer: 24,
  attachment: 12,
  bubble: 16,
  card: 16,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
};

export const Theme = {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
};

export default Theme;
export const Radius = BorderRadius;
