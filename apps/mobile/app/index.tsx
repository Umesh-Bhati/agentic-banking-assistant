import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinModal } from '../components/PinModal';
import { StatementCard } from '../components/StatementCard';
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
const SESSION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

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
    backgroundColor: '#fff',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#364b65',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  loginLogo: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#364b65',
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },
  loginInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#364b65',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D32F2F',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#364b65',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messagesContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#364b65',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#333',
  },
  streamingIndicator: {
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    backgroundColor: '#FAFAFA',
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#364b65',
    borderRadius: 24,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});