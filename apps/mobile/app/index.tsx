import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { PinModal } from '../components/PinModal';
import { StatementCard } from '../components/StatementCard';
import { MarkdownText } from '../components/MarkdownText';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import type { StatementCardData } from '@boit/types';

const LOGGED_IN_KEY = 'almasraf_logged_in';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  statementData?: StatementCardData;
}

interface ChatSession {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const API_BASE_URL = 'http://localhost:3000';

export default function ChatScreen() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('john.doe@almasraf.ae');
  const [password, setPassword] = useState('demo1234');
  const [loginLoading, setLoginLoading] = useState(false);

  const [sessionId, setSessionId] = useState<string>(generateUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalData, setPinModalData] = useState<{ cardType: string; last4: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOGGED_IN_KEY);
        if (stored === 'true') {
          setIsLoggedIn(true);
          fetchSessions();
        }
      } catch (e) {
        console.warn('Failed to read auth from SecureStore:', e);
      }
    };
    checkAuth();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch sessions:', e);
    }
  };

  const loadSession = async (id: string) => {
    setSessionId(id);
    setIsSidebarOpen(false);
    setMessages([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages: Message[] = (data || []).map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          statementData: msg.ui_data?.type === 'STATEMENT_CARD' ? msg.ui_data.data : undefined,
        }));
        setMessages(loadedMessages);
      }
    } catch (e) {
      console.warn('Failed to fetch messages:', e);
    }
  };

  const handleNewChat = () => {
    setSessionId(generateUUID());
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const deleteSession = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (id === sessionId) {
          handleNewChat();
        }
      }
    } catch (e) {
      console.warn('Failed to delete session:', e);
    }
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    setLoginLoading(true);
    setTimeout(async () => {
      setLoginLoading(false);
      try {
        await SecureStore.setItemAsync(LOGGED_IN_KEY, 'true');
      } catch (e) {
        console.warn('Failed to save auth to SecureStore:', e);
      }
      setIsLoggedIn(true);
      fetchSessions();
    }, 400);
  };

  const handleLogout = () => {
    SecureStore.deleteItemAsync(LOGGED_IN_KEY).catch(e => console.warn('Failed to clear auth:', e));
    setIsLoggedIn(false);
    setMessages([]);
    setSessions([]);
    setSessionId(generateUUID());
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
              setIsLoading(false);
              // Fetch sessions to update the sidebar with any new title
              fetchSessions();
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error || 'Unknown error');
            } else if (parsed.type === 'auth_required') {
              const authData = parsed;
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
                  ? { ...msg, statementData: parsed.data }
                  : msg
              ));
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
        // Refresh sessions to get updated titles
        fetchSessions();
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
      sessionId: sessionId,
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
          sessionId: sessionId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowPinModal(false);
        setPinModalData(null);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
        }]);
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
        item.role === 'user' ? (
          <Text style={[styles.messageText, styles.userMessageText]}>
            {item.content}
          </Text>
        ) : (
          <MarkdownText
            content={item.content}
            style={[styles.messageText, styles.assistantMessageText]}
          />
        )
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
            <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuButton}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
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

        <Modal visible={isSidebarOpen} animationType="slide" transparent={true}>
          <View style={styles.sidebarOverlay}>
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Chat History</Text>
                <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={styles.closeSidebarButton}>
                  <Text style={styles.closeSidebarText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
                <Text style={styles.newChatText}>+ New Chat</Text>
              </TouchableOpacity>

              <FlatList
                data={sessions}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.sessionItem, item.id === sessionId && styles.activeSessionItem]}>
                    <TouchableOpacity style={styles.sessionSelect} onPress={() => loadSession(item.id)}>
                      <Text style={[styles.sessionTitle, item.id === sessionId && styles.activeSessionTitle]} numberOfLines={1}>
                        {item.title || 'New Conversation'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => deleteSession(item.id)}>
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={styles.sessionList}
              />
            </View>
            <TouchableOpacity style={styles.sidebarBackdrop} onPress={() => setIsSidebarOpen(false)} />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loginContainer: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  loginCard: { width: '100%', maxWidth: 380, backgroundColor: Colors.background, borderRadius: BorderRadius.xl, padding: Spacing.xxl, ...Shadows.modal },
  loginLogo: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.sm },
  loginTitle: { fontSize: Typography.title.fontSize, fontWeight: Typography.weight.bold, color: Colors.primary, textAlign: 'center' },
  loginSubtitle: { fontSize: Typography.bodySmall.fontSize, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.xxl },
  inputGroup: { marginBottom: Spacing.lg },
  inputLabel: { fontSize: Typography.bodySmall.fontSize, fontWeight: Typography.weight.semibold, color: Colors.textPrimary, marginBottom: 6 },
  loginInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: Colors.surface, color: Colors.textPrimary },
  loginButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: Colors.textLight, fontSize: 16, fontWeight: Typography.weight.semibold },
  header: { padding: Spacing.xl, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuButton: { padding: 8, marginRight: 8 },
  menuIcon: { fontSize: 24, color: Colors.primary },
  logoutButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  logoutButtonText: { fontSize: 12, fontWeight: Typography.weight.semibold, color: Colors.error },
  headerTitle: { fontSize: Typography.title.fontSize, fontWeight: Typography.weight.bold, color: Colors.primary, flex: 1 },
  headerSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.xs, marginLeft: 44 },
  messagesContainer: { flexGrow: 1, padding: Spacing.lg, paddingBottom: Spacing.xl },
  messageContainer: { maxWidth: '80%', marginBottom: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg },
  userMessage: { alignSelf: 'flex-end', backgroundColor: Colors.userBubble },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: Colors.assistantBubble },
  messageText: { fontSize: Typography.bodyLarge.fontSize, lineHeight: Typography.bodyLarge.lineHeight },
  userMessageText: { color: Colors.userBubbleText },
  assistantMessageText: { color: Colors.assistantBubbleText },
  streamingIndicator: { marginTop: Spacing.xs, alignSelf: 'flex-end' },
  inputContainer: { flexDirection: 'row', padding: Spacing.md, paddingBottom: Spacing.xl, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.lg, paddingVertical: 10, fontSize: 16, maxHeight: 120, backgroundColor: Colors.surface },
  sendButton: { marginLeft: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: BorderRadius.pill, justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: Colors.disabled },
  sendButtonText: { color: Colors.textLight, fontWeight: Typography.weight.semibold, fontSize: 16 },
  
  sidebarOverlay: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 300, backgroundColor: Colors.background, height: '100%', borderRightWidth: 1, borderRightColor: Colors.border, padding: Spacing.lg, paddingTop: 60 },
  sidebarBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  sidebarTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.primary },
  closeSidebarButton: { padding: 8 },
  closeSidebarText: { fontSize: 20, color: Colors.textSecondary },
  newChatButton: { backgroundColor: Colors.primary, padding: 12, borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.lg },
  newChatText: { color: Colors.textLight, fontWeight: 'bold' },
  sessionList: { paddingBottom: Spacing.xl },
  sessionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  activeSessionItem: { backgroundColor: Colors.surfaceAlt },
  sessionSelect: { flex: 1 },
  sessionTitle: { fontSize: 16, color: Colors.textPrimary },
  activeSessionTitle: { fontWeight: 'bold', color: Colors.primary },
  deleteButton: { padding: 8 },
  deleteButtonText: { fontSize: 16 },
});
