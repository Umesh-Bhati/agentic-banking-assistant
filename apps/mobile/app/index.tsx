import { View, ActivityIndicator } from 'react-native';
import { AssistantRuntimeProvider, useLocalRuntime, type ThreadMessageLike } from '@assistant-ui/react-native';
import { useChat } from '../context/ChatContext';
import { Thread } from '../components/assistant-ui/elements/thread.aui';
import { PinModal } from '../features/auth/components/PinModal';
import { LoginScreen } from '../features/auth/components/LoginScreen';
function ChatRuntimeWrapper() {
  const { chatModelAdapter, messages } = useChat();
  const initialMessages: ThreadMessageLike[] = messages.map(message => ({ id: message.id, role: message.role, content: message.content, metadata: { custom: { bankingTurnId: message.bankingTurnId } } }));
  const runtime = useLocalRuntime(chatModelAdapter, { initialMessages });
  return <AssistantRuntimeProvider runtime={runtime}><Thread /></AssistantRuntimeProvider>;
}
export default function MainScreen() {
  const { isLoggedIn, isSessionLoading, sessionId, showPinModal, pinModalData, pinLoading, pinError, handlePinSubmit, handlePinCancel } = useChat();
  if (!isLoggedIn) return <LoginScreen />;
  if (isSessionLoading) return <ActivityIndicator />;
  return <View style={{ flex: 1, backgroundColor: 'white' }}>
    <ChatRuntimeWrapper key={sessionId} />
    <PinModal visible={showPinModal} cardType={pinModalData?.cardType || ''} last4={pinModalData?.last4 || ''} onAuthSubmit={handlePinSubmit} onCancel={handlePinCancel} loading={pinLoading} error={pinError} />
  </View>;
}
