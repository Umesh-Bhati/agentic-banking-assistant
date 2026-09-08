import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { AppState, Alert } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import type { ChatModelAdapter } from '@assistant-ui/react-native';
import type { CustomerProfile } from '@boit/shared-types';
import { json, abortRequests, ApiError, onUnauthorized } from '../lib/api/client';
import { resourceId } from '../lib/api/policy';
import { restoreSession, saveSession, clearSession, type Session } from '../features/auth/services/session';
import { streamChat } from '../features/chat/services/stream';
import { chatRunError } from '../features/chat/services/run-error';
import { clearStatementFiles } from '../features/statements/services/download';
import { actions } from '../features/actions/services/actions';
import { parseUiEvent } from '../features/chat/services/ui-events';
import { restoreBankingMessages, type Message, type MessageBankingUi } from '../features/chat/services/message-events';
export type { Message } from '../features/chat/services/message-events';
export interface ChatSession { id: string; title?: string; created_at: string; updated_at: string; }
export interface AuthorizationPrompt { actionId: string; cardType: string; last4: string; }
const newId = randomUUID;
function useBankingState() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userProfile, setUserProfile] = useState<CustomerProfile | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>();
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [sessionId, setSessionId] = useState(newId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [uiEvents, setUiEvents] = useState<MessageBankingUi[]>([]);
  const [pinModalData, setPinModalData] = useState<AuthorizationPrompt | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string>();
  const generation = useRef(0);
  const liveSession = useRef<Session | null>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const authToken = session?.token || null;
  const resetPrivateState = () => {
    generation.current += 1; abortRequests(); streamAbort.current?.abort();
    try { clearStatementFiles(); } catch { /* Retry cleanup on next unlock. */ }
    setMessages([]); setSessions([]); setUiEvents([]); setUserProfile(null);
    setPinModalData(null); setPinError(undefined); setPassword(''); setSessionId(newId());
  };
  const expireSession = async () => {
    resetPrivateState(); liveSession.current = null; setSession(null); setIsLoggedIn(false);
    await clearSession();
  };
  const report = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) { void expireSession(); return; }
    Alert.alert('Banking request failed', error instanceof Error ? error.message : 'Please try again.');
  };
  const applySession = async (fresh: Session, expectedToken?: string) => {
    if (expectedToken && liveSession.current?.token !== expectedToken) throw new Error('Session changed; sign in again');
    const epoch = generation.current;
    await saveSession(fresh);
    if (epoch !== generation.current) { await clearSession(); throw new Error('Session changed; sign in again'); }
    liveSession.current = fresh; setSession(fresh);
  };
  const fetchProfile = async (tokenOverride?: string) => {
    const token = tokenOverride || liveSession.current?.token; if (!token) return;
    const epoch = generation.current;
    const data = await json<CustomerProfile>('/api/profile', token);
    if (epoch === generation.current) setUserProfile(data);
  };
  const fetchSessions = async (tokenOverride?: string) => {
    const token = tokenOverride || liveSession.current?.token; if (!token) return;
    const epoch = generation.current; setIsSessionsLoading(true);
    try { const data = await json<ChatSession[]>('/api/chat/sessions', token); if (epoch === generation.current) setSessions(data); }
    catch (error) { if (epoch === generation.current) report(error); }
    finally { if (epoch === generation.current) setIsSessionsLoading(false); }
  };
  const unlock = async () => {
    setLoginLoading(true);
    try {
      const available = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
      setCanUseBiometrics(available);
      if (!available) return; // Password login required without an enrolled local unlock factor.
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock banking', disableDeviceFallback: true });
      if (!result.success) return;
      const fresh = await restoreSession();
      if (!fresh) return;
      await applySession(fresh); await fetchProfile(fresh.token); setIsLoggedIn(true); await fetchSessions(fresh.token);
    } catch { await expireSession(); }
    finally { setLoginLoading(false); }
  };
  useEffect(() => {
    onUnauthorized(token => { if (liveSession.current?.token === token) void expireSession(); });
    void unlock();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        resetPrivateState(); liveSession.current = null; setSession(null); setIsLoggedIn(false);
      }
    });
    return () => { onUnauthorized(undefined); subscription.remove(); abortRequests(); streamAbort.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!session || !isLoggedIn) return;
    const epoch = generation.current;
    const timer = setTimeout(() => {
      void json<Session>('/api/auth/refresh', null, { refreshToken: session.refreshToken }).then(async fresh => {
        if (epoch === generation.current && liveSession.current?.token === session.token) await applySession(fresh);
      }).catch(() => { if (epoch === generation.current) void expireSession(); });
    }, Math.max(1000, session.expiresAt * 1000 - Date.now() - 60000));
    return () => clearTimeout(timer);
  }, [session, isLoggedIn]);
  const authenticate = async (path: string, credentials: unknown) => {
    resetPrivateState(); setIsLoggedIn(false); setLoginLoading(true); setLoginError(undefined);
    try {
      const epoch = generation.current;
      const fresh = await json<Session>(path, null, credentials);
      if (epoch !== generation.current) return;
      await applySession(fresh); await fetchProfile(fresh.token); setIsLoggedIn(true); setPassword(''); await fetchSessions(fresh.token);
    } catch (error) { await expireSession(); setLoginError(error instanceof Error ? error.message : 'Authentication failed'); }
    finally { setLoginLoading(false); }
  };
  const handleLogin = () => authenticate('/api/auth/login', { email: email.trim(), password });
  const handleLogout = async () => {
    const token = liveSession.current?.token;
    await expireSession();
    if (token) { try { await json('/api/auth/logout', token, {}); } catch { Alert.alert('Signed out on this device', 'Server sign-out could not be confirmed. Contact support to revoke other sessions if needed.'); } }
  };
  const handleNewChat = () => { streamAbort.current?.abort(); generation.current++; setSessionId(newId()); setMessages([]); setUiEvents([]); setPinModalData(null); };
  const loadSession = async (id: string) => {
    if (!authToken) return; handleNewChat(); const epoch = generation.current; setIsSessionLoading(true);
    try {
      const data = await json<Array<Message & { ui_data?: unknown }>>(`/api/chat/sessions/${resourceId(id)}/messages`, authToken);
      if (epoch !== generation.current) return;
      const restored = restoreBankingMessages(data);
      setSessionId(id); setMessages(restored.messages); setUiEvents(restored.events);
    } catch (error) { if (epoch === generation.current) report(error); }
    finally { if (epoch === generation.current) setIsSessionLoading(false); }
  };
  const deleteSession = async (id: string) => {
    if (!authToken) return;
    try { await json(`/api/chat/sessions/${resourceId(id)}`, authToken, undefined, 'DELETE'); if (id === sessionId) handleNewChat(); await fetchSessions(); } catch (error) { report(error); }
  };
  const chatModelAdapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages: outgoing, abortSignal }) {
      if (!authToken) throw new Error('Sign in before sending a message');
      const part = outgoing[outgoing.length - 1]?.content.find(part => part.type === 'text');
      if (!part || part.type !== 'text' || !part.text.trim()) throw new Error('Enter a message');
      const controller = new AbortController(); streamAbort.current?.abort(); streamAbort.current = controller;
      const abort = () => controller.abort(); abortSignal.addEventListener('abort', abort, { once: true });
      if (abortSignal.aborted) controller.abort();
      const epoch = generation.current; let text = '';
      const bankingTurnId = newId();
      const metadata = { custom: { bankingTurnId } };
      try {
        for await (const raw of streamChat(authToken, sessionId, part.text, controller.signal)) {
          if (epoch !== generation.current) return;
          const event = raw as { type: string; content?: string };
          if (event.type === 'text' && typeof event.content === 'string') { text += event.content; yield { content: [{ type: 'text', text }], metadata }; }
          const ui = parseUiEvent(raw);
          if (ui) {
            setUiEvents(previous => [...previous, { ...ui, bankingTurnId }]);
            yield { content: text ? [{ type: 'text', text }] : [], metadata };
          }
        }
        await fetchSessions();
      } catch (error) {
        const failure = await chatRunError(error, {
          isCurrent: () => epoch === generation.current,
          isCancelled: () => controller.signal.aborted || abortSignal.aborted,
          expireSession,
        });
        if (failure && epoch === generation.current && !controller.signal.aborted && !abortSignal.aborted) yield { ...failure, metadata };
      }
      finally { abortSignal.removeEventListener('abort', abort); controller.abort(); }
    },
  }), [authToken, sessionId]);
  const beginAuthorization = (prompt: AuthorizationPrompt) => { if (!authToken || liveSession.current?.token !== authToken) return; setPinModalData(prompt); setPinError(undefined); };
  const handlePinSubmit = async (code: string, factorId: string) => {
    if (!authToken || !pinModalData) return;
    const epoch = generation.current; setPinLoading(true); setPinError(undefined);
    try {
      const challenge = await actions.challenge(authToken, pinModalData.actionId, factorId);
      const result = await actions.authorize(authToken, pinModalData.actionId, challenge.challengeId, code);
      if (epoch !== generation.current) return;
      if (result.token && result.refreshToken && result.expiresAt) await applySession({ token: result.token, refreshToken: result.refreshToken, expiresAt: result.expiresAt });
      if (result.action.status !== 'COMPLETED') throw new Error('The operation is not complete. Check its status before retrying.');
      setUiEvents(events => events.map(event => event.type === 'STATEMENT_QUOTE' && event.data.actionId === result.action.id ? { ...event, data: { ...event.data, status: 'COMPLETED' } } : event));
      setPinModalData(null); Alert.alert('Operation completed', 'The bank confirmed this operation.');
    } catch (error) { if (epoch === generation.current) { if (error instanceof ApiError && error.status === 401) await expireSession(); else setPinError(error instanceof Error ? error.message : 'Authorization failed'); } }
    finally { if (epoch === generation.current) setPinLoading(false); }
  };
  const handlePinCancel = async () => {
    if (!authToken || !pinModalData) return; setPinLoading(true);
    try { await actions.cancel(authToken, pinModalData.actionId); setPinModalData(null); setPinError(undefined); }
    catch (error) { setPinError('Cancellation could not be confirmed. Check status before retrying.'); }
    finally { setPinLoading(false); }
  };
  const checkActionStatus = async () => {
    if (!authToken || !pinModalData) return;
    try { const result = await actions.status(authToken, pinModalData.actionId); setPinError(`Bank status: ${result.action.status}`); } catch (error) { report(error); }
  };
  return { isLoggedIn, loginLoading, loginError, authToken, canUseBiometrics, email, setEmail, password, setPassword,
    handleLogin, handleBiometricAuth: unlock, handleLogout, userProfile, fetchProfile, applySession,
    sessionId, sessions, messages, isSessionsLoading, isSessionLoading, fetchSessions, loadSession, deleteSession, handleNewChat,
    chatModelAdapter, uiEvents, pinModalData, showPinModal: !!pinModalData, beginAuthorization, pinLoading, pinError, handlePinSubmit, handlePinCancel, checkActionStatus };
}
const ChatContext = createContext<ReturnType<typeof useBankingState> | undefined>(undefined);
export function ChatProvider({ children }: { children: React.ReactNode }) { return <ChatContext.Provider value={useBankingState()}>{children}</ChatContext.Provider>; }
export function useChat() { const value = useContext(ChatContext); if (!value) throw new Error('ChatProvider required'); return value; }
