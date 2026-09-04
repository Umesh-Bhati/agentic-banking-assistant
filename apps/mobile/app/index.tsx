import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinModal } from '../components/PinModal';
import { StatementCard } from '../components/StatementCard';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import type { StatementCardData } from '@boit/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  statementData?: StatementCardData;
}

interface AuthRequiredData {
  type: 'auth_required';
  workflowState: any;
  suspendData: {
    cardType: string;
    last4: string;
  };
}

const API_BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Seeded chat session ID for John Doe

export default function ChatScreen() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('john.doe@almasraf.ae');
  const [password, setPassword] = useState('demo1234');
  const [loginLoading, setLoginLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalData, setPinModalData] = useState<{ cardType: string; last4: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>();

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('almasraf_logged_in');
        if (stored === 'true') {
          setIsLoggedIn(true);
        }
      }
    } catch (e) {}
  }, []);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    setLoginLoading(true);
    setTimeout(() => {
      setLoginLoading(false);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('almasraf_logged_in', 'true');
        }
      } catch (e) {}
      setIsLoggedIn(true);
    }, 400);
  };

  const handleLogout = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('almasraf_logged_in');
      }
    } catch (e) {}
    setIsLoggedIn(false);
    setMessages([]);
    setHistory([]);
  };

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    const newHistory = [...history, { role: 'user' as const, content: inputText }];
    setHistory(newHistory);
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsLoading(true);

    let assistantContent = '';
    let buffer = '';

    const handleChunk = (chunkText: string) => {
      buffer += chunkText;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'token' && parsed.content) {
              assistantContent += parsed.content;
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, content: assistantContent }
                  : msg
              ));
            } else if (parsed.type === 'done') {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, content: assistantContent, isStreaming: false }
                  : msg
              ));
              setHistory(prev => [...prev, { role: 'assistant' as const, content: assistantContent }]);
              setIsLoading(false);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error || 'Unknown error');
            } else if (parsed.type === 'auth_required') {
              const authData = parsed as AuthRequiredData;
              setPinModalData({
                cardType: authData.suspendData.cardType,
                last4: authData.suspendData.last4,
              });
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, isStreaming: false }
                  : msg
              ));
              setShowPinModal(true);
              setIsLoading(false);
            } else if (parsed.type === 'STATEMENT_CARD' && parsed.data) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, statementData: parsed.data, isStreaming: false }
                  : msg
              ));
              setIsLoading(false);
            } else if (parsed.type === 'workflow_suspended') {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, isStreaming: false }
                  : msg
              ));
              setIsLoading(false);
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/chat`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let seenBytes = 0;

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const newText = xhr.responseText.substring(seenBytes);
        seenBytes = xhr.responseText.length;
        if (newText) {
          handleChunk(newText);
        }
      }
      if (xhr.readyState === 4) {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('Chat HTTP error:', xhr.status);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
              : msg
          ));
        }
        setIsLoading(false);
      }
    };

    xhr.onerror = (error) => {
      console.error('Chat network error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'Network error. Please make sure the server is running.', isStreaming: false }
          : msg
      ));
      setIsLoading(false);
    };

    xhr.send(JSON.stringify({
      message: currentInput,
      sessionId: SESSION_ID,
      history: newHistory,
    }));
  };

  const handlePinSubmit = async (pin: string) => {
    setPinLoading(true);
    setPinError(undefined);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authToken: pin,
          sessionId: SESSION_ID,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success - close modal and add confirmation message
        setShowPinModal(false);
        setPinModalData(null);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
        }]);
        setHistory(prev => [...prev, { role: 'assistant' as const, content: data.message }]);
      } else {
        setPinError(data.error || 'Authorization failed');
      }
    } catch (error) {
      setPinError('Network error. Please try again.');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinCancel = () => {
    setShowPinModal(false);
    setPinModalData(null);
    setPinError(undefined);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      {item.statementData ? (
        <StatementCard data={item.statementData} />
      ) : (
        <Text style={[
          styles.messageText,
          item.role === 'user' ? styles.userMessageText : styles.assistantMessageText
        ]}>
          {item.content}
        </Text>
      )}
      {item.isStreaming && (
        <ActivityIndicator size="small" color="#364b65" style={styles.streamingIndicator} />
      )}
    </View>
  );

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.loginLogo}>🏦</Text>
          <Text style={styles.loginTitle}>Al Masraf Mobile Banking</Text>
          <Text style={styles.loginSubtitle}>Log in to access your Banking Assistant</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.loginInput}
              value={email}
              onChangeText={setEmail}
              placeholder="name@almasraf.ae"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password / Passcode</Text>
            <TextInput
              style={styles.loginInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loginLoading && styles.sendButtonDisabled]}
            onPress={handleLogin}
            disabled={loginLoading}
          >
            {loginLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Log In to Mobile Banking</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Al Masraf Assistant</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Logged in as John Doe</Text>
        </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          placeholder="Ask about accounts, cards, or loans..."
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity 
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={isLoading || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>{isLoading ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>

      <PinModal
        visible={showPinModal}
        cardType={pinModalData?.cardType || ''}
        last4={pinModalData?.last4 || ''}
        onAuthSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        loading={pinLoading}
        error={pinError}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loginContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loginCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    ...Shadows.modal,
  },
  loginLogo: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  loginTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  loginInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: Typography.weight.semibold,
  },
  header: {
    padding: Spacing.xl,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: Typography.weight.semibold,
    color: Colors.error,
  },
  headerTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  messagesContainer: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.userBubble,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.assistantBubble,
  },
  messageText: {
    fontSize: Typography.bodyLarge.fontSize,
    lineHeight: Typography.bodyLarge.lineHeight,
  },
  userMessageText: {
    color: Colors.userBubbleText,
  },
  assistantMessageText: {
    color: Colors.assistantBubbleText,
  },
  streamingIndicator: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    backgroundColor: Colors.surface,
  },
  sendButton: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.pill,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  sendButtonText: {
    color: Colors.textLight,
    fontWeight: Typography.weight.semibold,
    fontSize: 16,
  },
});