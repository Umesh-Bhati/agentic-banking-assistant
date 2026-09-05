import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { StatementCardData } from '@boit/types';
import { FlatList } from 'react-native';
import { useLocalRuntime } from '@assistant-ui/react-native';
import type { ChatModelAdapter, AssistantRuntime } from '@assistant-ui/react-native';

const LOGGED_IN_KEY = 'almasraf_logged_in';

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
  email: string;
  setEmail: (e: string) => void;
  password: string;
  setPassword: (p: string) => void;
  handleLogin: () => void;
  handleLogout: () => void;
  
  sessionId: string;
  sessions: ChatSession[];
  messages: Message[];
  inputText: string;
  setInputText: (t: string) => void;
  isLoading: boolean;
  
  showPinModal: boolean;
  pinModalData: { cardType: string; last4: string } | null;
  pinLoading: boolean;
  pinError: string | undefined;
  
  handleNewChat: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  sendMessage: (overrideText?: string | any) => void;
  handlePinSubmit: (pin: string) => void;
  handlePinCancel: () => void;
  
  flatListRef: React.RefObject<FlatList<Message> | null>;
  runtime: AssistantRuntime;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('john.doe@almasraf.ae');
  const [password, setPassword] = useState('demo1234');
  const [loginLoading, setLoginLoading] = useState(false);

  const [sessionId, setSessionId] = useState<string>(generateUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  
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

  const chatModelAdapter: ChatModelAdapter = React.useMemo(() => ({
    async *run(options) {
      let resolve: ((val: string | null) => void) | null = null;
      const chunks: (string | null)[] = [];
      let lastProcessedIndex = 0;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/chat`);
      xhr.setRequestHeader('Content-Type', 'application/json');

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
              if (parsed.type === 'token') {
                text += parsed.content;
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              } else if (parsed.type === 'tool_call') {
                toolCalls.push({ type: 'tool-call', toolName: parsed.toolName, toolCallId: parsed.toolCallId, args: parsed.args || {} });
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              } else if (parsed.type === 'tool_result') {
                toolCalls.push({ type: 'tool-result', toolName: parsed.toolName, toolCallId: parsed.toolCallId, result: parsed.result || {} });
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              } else if (parsed.type === 'auth_required') {
                setShowPinModal(true);
                setPinModalData({ cardType: parsed.suspendData.cardType, last4: parsed.suspendData.last4 });
              } else if (parsed.type === 'STATEMENT_CARD' && parsed.data) {
                toolCalls.push({ type: 'tool-call', toolName: 'StatementCard', toolCallId: Date.now().toString(), args: parsed.data });
                yield { content: [{ type: 'text', text }, ...toolCalls] };
              }
            } catch (e) {}
          }
        }
      }
    }
  }), [sessionId]);

  const runtime = useLocalRuntime(chatModelAdapter);

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
            if (parsed.type === 'token' && parsed.content) {
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
    sendMessage('Cancel');
  };

  return (
    <ChatContext.Provider
      value={{
        isLoggedIn,
        loginLoading,
        email,
        setEmail,
        password,
        setPassword,
        handleLogin,
        handleLogout,
        sessionId,
        sessions,
        messages,
        inputText,
        setInputText,
        isLoading,
        showPinModal,
        pinModalData,
        pinLoading,
        pinError,
        handleNewChat,
        loadSession,
        deleteSession,
        sendMessage,
        handlePinSubmit,
        handlePinCancel,
        flatListRef,
        runtime,
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
