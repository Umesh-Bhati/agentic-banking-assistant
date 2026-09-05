import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Thread } from '../components/assistant-ui/elements/thread.aui';
import { Colors } from '../constants/theme';
import { useChat } from '../context/ChatContext';
import { AssistantRuntimeProvider } from '@assistant-ui/react-native';
import { PinModal } from '../components/PinModal';

import { useLocalRuntime, type ThreadMessageLike } from '@assistant-ui/react-native';

function ChatRuntimeWrapper({ sessionId }: { sessionId: string }) {
  const { chatModelAdapter, messages, isSessionLoading } = useChat();

  const initialMessages: ThreadMessageLike[] = messages.map(msg => {
    if (msg.role === 'user') {
      return { role: 'user', content: msg.content };
    }
    
    // For assistant messages, we need to handle text and potential tool calls
    const content: any = [{ type: 'text', text: msg.content || '' }];
    if (msg.statementData) {
      content.push({
        type: 'tool-call',
        toolName: 'StatementCard',
        toolCallId: msg.id + '-tool',
        args: msg.statementData
      } as any);
    }
    return { role: 'assistant', content };
  });

  const runtime = useLocalRuntime(chatModelAdapter, { initialMessages });

  if (isSessionLoading) {
    return <View style={styles.container} />; // Or a loading spinner
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

export default function ChatScreen() {
  const { sessionId, showPinModal, pinModalData, pinLoading, pinError, handlePinSubmit, handlePinCancel } = useChat();
  
  return (
    <View style={styles.container}>
      <ChatRuntimeWrapper key={sessionId} sessionId={sessionId} />
      <PinModal
        visible={showPinModal}
        cardType={pinModalData?.cardType || 'Card'}
        last4={pinModalData?.last4 || '****'}
        onAuthSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        loading={pinLoading}
        error={pinError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }
});
