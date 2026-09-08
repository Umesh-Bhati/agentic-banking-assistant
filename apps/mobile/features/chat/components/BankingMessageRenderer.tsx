import { Text } from 'react-native';
import { useTheme } from '../../../hooks/use-theme';
// Assistant prose is always inert text, including JSON, URLs, HTML and image syntax.
export function BankingMessageRenderer({ content }: { content: string }) {
  const { colors } = useTheme();
  return <Text selectable style={{ fontSize: 16, lineHeight: 25, color: colors.foreground }}>{content}</Text>;
}
