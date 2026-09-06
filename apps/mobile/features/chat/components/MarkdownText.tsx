import { View, StyleSheet, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Colors, Typography, Spacing } from '../../../constants/theme';

interface MarkdownTextProps {
  content: string;
  style?: any;
}

const styles = StyleSheet.create({
  container: {
    // flex: 1,
  },
});

export function MarkdownText({ content, style }: MarkdownTextProps) {
  return (
    <View style={[styles.container, style]}>
      <Markdown
        children={content}
        onLinkPress={(url) => {
          Linking.openURL(url).catch(() => {});
          return true;
        }}
      />
    </View>
  );
}