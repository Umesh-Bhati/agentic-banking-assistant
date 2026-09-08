import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BankingMessageRenderer } from './BankingMessageRenderer';
export function MarkdownText({ content, style }: { content: string; style?: StyleProp<ViewStyle> }) {
  return <View style={style}><BankingMessageRenderer content={content} /></View>;
}
