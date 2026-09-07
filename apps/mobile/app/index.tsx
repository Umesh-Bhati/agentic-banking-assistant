import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Thread } from '../components/assistant-ui/elements/thread.aui';
import { Colors } from '../constants/theme';
import { useChat } from '../context/ChatContext';
import { AssistantRuntimeProvider } from '@assistant-ui/react-native';
import { PinModal } from '../features/auth/components/PinModal';
import { LoginScreen } from '../features/auth/components/LoginScreen';

import { useLocalRuntime, type ThreadMessageLike } from '@assistant-ui/react-native';

function ChatRuntimeWrapper({ sessionId }: { sessionId: string }) {
  const { chatModelAdapter, messages } = useChat();

  const initialMessages: ThreadMessageLike[] = messages.map(msg => {
    if (msg.role === 'user') {
      return { role: 'user', content: msg.content };
    }
    
    // For assistant messages, we handle text and potential statement tool card UI
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

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

export default function MainScreen() {
  const { 
    isLoggedIn, 
    userProfile,
    sessionId, 
    messages, 
    isSessionLoading, 
    showPinModal, 
    pinModalData, 
    pinLoading, 
    pinError, 
    handlePinSubmit, 
    handlePinCancel 
  } = useChat();
  
  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  if (isSessionLoading) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ChatRuntimeWrapper key={`${sessionId}-${messages.length}`} sessionId={sessionId} />
      <PinModal
        visible={showPinModal}
        authPreference={userProfile?.auth_preference as any}
        userEmail={userProfile?.email}
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
  container: { flex: 1, backgroundColor: Colors.background },
  loadingCenter: { justifyContent: 'center', alignItems: 'center' }
});
