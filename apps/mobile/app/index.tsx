import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Thread } from '../components/assistant-ui/elements/thread.aui';
import { Colors } from '../constants/theme';
import { useChat } from '../context/ChatContext';
import { AssistantRuntimeProvider } from '@assistant-ui/react-native';
import { PinModal } from '../components/PinModal';

export default function ChatScreen() {
  const { runtime, showPinModal, pinModalData, pinLoading, pinError, handlePinSubmit, handlePinCancel } = useChat();
  
  return (
    <View style={styles.container}>
      <AssistantRuntimeProvider runtime={runtime}>
        <Thread />
      </AssistantRuntimeProvider>
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
