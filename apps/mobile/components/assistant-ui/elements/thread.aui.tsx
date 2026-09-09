import { View, Text, StyleSheet } from "react-native";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatScroll } from "../../../features/chat/components/useChatScroll";
import { MessageBubble } from "./message";
import { Composer } from "./composer";
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react-native";
import { useTheme } from "../../../hooks/use-theme";
import { Radius, Spacing } from "../../../constants/theme";
import { haptics } from "../../../lib/haptics";

const suggestions = [
  "Show my recent transactions",
  "Block my credit card",
  "Download account statement",
  "Check my account balance",
];

function SuggestionChip({ prompt }: { prompt: string }) {
  const { colors } = useTheme();
  return (
    <ThreadPrimitive.Suggestion
      prompt={prompt}
      send
      onPressIn={haptics.selection}
      style={({ pressed }: { pressed: boolean }) => [
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.muted : colors.background,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: colors.foreground }]}>
        {prompt}
      </Text>
    </ThreadPrimitive.Suggestion>
  );
}

function EmptyState() {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.welcome, { color: colors.foreground }]}>
        How can I help you today?
      </Text>
      <View style={styles.chips}>
        {suggestions.map((prompt) => (
          <SuggestionChip key={prompt} prompt={prompt} />
        ))}
      </View>
    </View>
  );
}

function ChatMessages() {
  const scroll = useChatScroll();
  return (
    <>
      <AuiIf condition={(s) => s.thread.isEmpty}>
        <EmptyState />
      </AuiIf>
      <AuiIf condition={(s) => !s.thread.isEmpty}>
        <ThreadPrimitive.MessagesFlatList
          {...scroll}
          autoScroll={false}
          scrollToBottomOnInitialize={false}
          scrollToBottomOnRunStart={false}
          scrollToBottomOnThreadSwitch={false}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          style={styles.flex}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {() => <MessageBubble />}
        </ThreadPrimitive.MessagesFlatList>
      </AuiIf>
    </>
  );
}

function useGradualKeyboardHeight() {
  const height = useSharedValue(0);

  useKeyboardHandler(
    {
      onMove: (event) => {
        "worklet";
        height.value = Math.max(event.height, 0);
      },
    },
    [],
  );

  return height;
}

export function Thread() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const keyboardHeight = useGradualKeyboardHeight();
  const keyboardSpacer = useAnimatedStyle(() => ({
    height: Math.abs(keyboardHeight.value),
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.flex}>
        <ChatMessages />
      </View>
      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <Composer />
      </View>
      <Animated.View style={keyboardSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  messageList: {
    width: "100%",
    maxWidth: Spacing.threadMaxWidth,
    marginHorizontal: "auto",
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 18,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  welcome: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 24,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
