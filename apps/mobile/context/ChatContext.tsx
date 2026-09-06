import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import type { StatementCardData } from '@boit/shared-types';
import { FlatList, AppState, AppStateStatus } from 'react-native';
import { useLocalRuntime } from '@assistant-ui/react-native';
import type { ChatModelAdapter, AssistantRuntime } from '@assistant-ui/react-native';

const LOGGED_IN_KEY = 'almasraf_logged_in';
const AUTH_TOKEN_KEY = 'almasraf_auth_token';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  statementData?: StatementCardData;
}

export interface ChatSession {
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

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri;
    const localhost = debuggerHost?.split(':')[0] || 'localhost';
    return `http://${localhost}:3000`;
  }
  return 'http://localhost:3000';
};

const API_BASE_URL = getApiBaseUrl();

interface ChatContextType {
  isLoggedIn: boolean;
  loginLoading: boolean;
  loginError?: string;
  authToken: string | null;
  canUseBiometrics: boolean;
  email: string;
  setEmail: (e: string) => void;
  password: string;
  setPassword: (p: string) => void;
  handleLogin: () => void;
  handleBiometricAuth: () => void;
  handleLogout: () => void;
  
  sessionId: string;
  sessions: ChatSession[];
  isSessionsLoading: boolean;
  messages: Message[];
  inputText: string;
  setInputText: (t: string) => void;
  isLoading: boolean;
  isSessionLoading: boolean;
  
  showPinModal: boolean;
  setShowPinModal: (s: boolean) => void;
  pinModalData: { cardType: string; last4: string } | null;
  setPinModalData: (d: { cardType: string; last4: string } | null) => void;
  pinLoading: boolean;
  pinError: string | undefined;
  
  handleNewChat: () => void;
  fetchSessions: (tokenOverride?: string) => Promise<void>;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  sendMessage: (overrideText?: string | any) => void;
  handlePinSubmit: (pin: string) => void;
  handlePinCancel: () => void;
  
  flatListRef: React.RefObject<FlatList<Message> | null>;
  chatModelAdapter: any;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('john.doe@gmail.com');
  const [password, setPassword] = useState('demo1234');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);

  const [sessionId, setSessionId] = useState<string>(generateUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalData, setPinModalData] = useState<{ cardType: string; last4: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>();

  const appState = useRef(AppState.currentState);

  const triggerBiometricUnlock = useCallback(async (token: string) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Al Masraf Mobile Banking',
        fallbackLabel: 'Enter Password',
      });
      if (result.success) {
        setAuthToken(token);
        setIsLoggedIn(true);
        fetchSessions(token);
        return true;
      } else {
        setIsLoggedIn(false);
        return false;
      }
    } catch (e) {
      console.warn('Biometric auth error:', e);
      setIsLoggedIn(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        const storedLoggedIn = await SecureStore.getItemAsync(LOGGED_IN_KEY);
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        const biometricsAvailable = hasHardware && isEnrolled;
        setCanUseBiometrics(biometricsAvailable && (!!storedToken || storedLoggedIn === 'true'));

        if (storedLoggedIn === 'true' && storedToken) {
          if (biometricsAvailable) {
            // Prompt for biometrics on launch before unlocking!
            triggerBiometricUnlock(storedToken);
          } else {
            setAuthToken(storedToken);
            setIsLoggedIn(true);
            fetchSessions(storedToken);
          }
        }
      } catch (e) {
        console.warn('Failed to read auth from SecureStore:', e);
      }
    };
    checkAuth();
  }, [triggerBiometricUnlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        try {
          const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
          const storedLoggedIn = await SecureStore.getItemAsync(LOGGED_IN_KEY);
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (storedLoggedIn === 'true' && storedToken && hasHardware && isEnrolled) {
            setIsLoggedIn(false);
            triggerBiometricUnlock(storedToken);
          }
        } catch (e) {
          console.warn('Error checking biometrics on app resume:', e);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [triggerBiometricUnlock]);

  const chatModelAdapter: ChatModelAdapter = React.useMemo(() => ({
    async *run(options) {
      let resolve: ((val: string | null) => void) | null = null;
      const chunks: (string | null)[] = [];
      let lastProcessedIndex = 0;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/chat`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const newData = xhr.responseText.substring(lastProcessedIndex);
          if (newData) {
            lastProcessedIndex = xhr.responseText.length;
            if (resolve) { resolve(newData); resolve = null; } else { chunks.push(newData); }
          }
        }
        if (xhr.readyState === 4) {
          if (resolve) { resolve(null); resolve = null; } else { chunks.push(null); }
        }
      };

      const lastUserMsg = options.messages[options.messages.length - 1];
      const textContent = lastUserMsg?.content?.find((c: any) => c.type === 'text');
      const textToSend = textContent ? (textContent as any).text : '';

      xhr.send(JSON.stringify({
        message: textToSend,
        sessionId: sessionId,
      }));

      let buffer = '';
      let text = '';
      const toolCalls: any[] = [];

      while (true) {
        let chunk = chunks.length > 0 ? chunks.shift()! : await new Promise<string | null>(res => { resolve = res; });
        if (chunk === null) break;
        
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if ((parsed.type === 'text' || parsed.type === 'token') && parsed.content) {
                text += parsed.content;
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              } else if (parsed.type === 'tool_call') {
                toolCalls.push({ type: 'tool-call', toolName: parsed.toolName, toolCallId: parsed.toolCallId, args: parsed.args || {} });
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              } else if (parsed.type === 'tool_result') {
                const existingIdx = toolCalls.findIndex(t => t.toolCallId === parsed.toolCallId);
                if (existingIdx !== -1) {
                  toolCalls[existingIdx] = { ...toolCalls[existingIdx], result: parsed.result || {} };
                } else {
                  toolCalls.push({ type: 'tool-call', toolName: parsed.toolName, toolCallId: parsed.toolCallId, args: {}, result: parsed.result || {} });
                }
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              } else if (parsed.type === 'auth_required') {
                setShowPinModal(true);
                setPinModalData({ cardType: parsed.suspendData.cardType, last4: parsed.suspendData.last4 });
              } else if (parsed.type === 'STATEMENT_CARD' && parsed.data) {
                toolCalls.push({ type: 'tool-call', toolName: 'StatementCard', toolCallId: generateUUID(), args: parsed.data });
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              }
            } catch (e) {}
          }
        }
      }
      fetchSessions();
    }
  }), [sessionId, authToken]);

  const fetchSessions = async (tokenOverride?: string) => {
    setIsSessionsLoading(true);
    try {
      const activeToken = tokenOverride || authToken;
      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch sessions:', e);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const loadSession = async (id: string) => {
    setSessionId(id);
    setIsSessionLoading(true);
    try {
      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}/messages`, { headers });
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
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleNewChat = () => {
    setSessionId(generateUUID());
    setMessages([]);
    setIsSessionLoading(false);
  };

  const deleteSession = async (id: string) => {
    try {
      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}`, { method: 'DELETE', headers });
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

  const handleBiometricAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (storedToken) {
        await triggerBiometricUnlock(storedToken);
      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Al Masraf Mobile Banking',
          fallbackLabel: 'Enter Password',
        });
        if (result.success) {
          setIsLoggedIn(true);
        }
      }
    } catch (e) {
      console.warn('Biometric auth error:', e);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter your Email Address and Password.');
      return;
    }
    setLoginLoading(true);
    setLoginError(undefined);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        const token = data.token;
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        await SecureStore.setItemAsync(LOGGED_IN_KEY, 'true');
        setAuthToken(token);
        setIsLoggedIn(true);
        setPassword('');
        fetchSessions(token);
      } else {
        setLoginError(data.error || 'Invalid email or password. Please try again.');
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setLoginError('Authentication request timed out. Please try again.');
      } else {
        setLoginError('Unable to connect to the banking server. Please check your network connection.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    SecureStore.deleteItemAsync(LOGGED_IN_KEY).catch(() => {});
    SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => {});
    setIsLoggedIn(false);
    setAuthToken(null);
    setMessages([]);
    setSessions([]);
    setSessionId(generateUUID());
  };

  const sendMessage = async (overrideText?: string | any) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    const currentInput = textToSend;
    if (typeof overrideText !== 'string') {
      setInputText('');
    }
    setIsLoading(true);

    let assistantContent = '';
    let buffer = '';

    const handleChunk = (chunkText: string) => {
      buffer += chunkText;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let tokenUpdated = false;

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if ((parsed.type === 'text' || parsed.type === 'token') && parsed.content) {
              assistantContent += parsed.content;
              tokenUpdated = true;
            } else if (parsed.type === 'done') {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, content: assistantContent, isStreaming: false }
                  : msg
              ));
              setIsLoading(false);
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
          }
        }
      }

      if (tokenUpdated) {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: assistantContent }
            : msg
        ));
      }
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/chat`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
    if (authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }

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
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
              : msg
          ));
        }
        setIsLoading(false);
        fetchSessions();
      }
    };

    xhr.onerror = (error) => {
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
      const isBiometric = pin === 'BIOMETRIC_SUCCESS' || pin.startsWith('bio_');
      const targetActionId = (pinModalData as any)?.actionId || 'act_demo';
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/actions/${targetActionId}/authorize`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          isBiometric 
            ? { biometricToken: `bio_verified_${Date.now()}` } 
            : { pin }
        ),
      });

      const data = await response.json();

      if (response.ok && (data.success || data.action?.status === 'AUTHORIZED' || data.action?.status === 'COMPLETED')) {
        const cardType = pinModalData?.cardType || 'Credit';
        const last4 = pinModalData?.last4 || '****';
        setShowPinModal(false);
        setPinModalData(null);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ **Card Block Successful**\n\nYour ${cardType} card ending in **•••• ${last4}** has been blocked.`,
        }]);
      } else {
        setPinError(data.error || 'Authorization failed. Please check your passcode.');
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
    sendMessage('Cancel');
  };

  return (
    <ChatContext.Provider
      value={{
        isLoggedIn,
        loginLoading,
        loginError,
        authToken,
        canUseBiometrics,
        email,
        setEmail,
        password,
        setPassword,
        handleLogin,
        handleBiometricAuth,
        handleLogout,
        sessionId,
        sessions,
        isSessionsLoading,
        messages,
        inputText,
        setInputText,
        isLoading,
        isSessionLoading,
        showPinModal,
        setShowPinModal,
        pinModalData,
        setPinModalData,
        pinLoading,
        pinError,
        handleNewChat,
        fetchSessions,
        loadSession,
        deleteSession,
        sendMessage,
        handlePinSubmit,
        handlePinCancel,
        flatListRef,
        chatModelAdapter,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
