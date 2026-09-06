import { SupabaseClient } from '@supabase/supabase-js';

export interface ChatSessionRow {
  id: string;
  user_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  ui_data?: any;
  created_at: string;
}

export class SessionService {
  constructor(private supabase: SupabaseClient) {}

  async getUserSessions(userId: string): Promise<ChatSessionRow[]> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Error fetching chat sessions:', error.message);
      return [];
    }
    return data || [];
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessageRow[]> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Error fetching session messages:', error.message);
      return [];
    }
    return data || [];
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Error deleting chat session:', error.message);
      return false;
    }
    return true;
  }

  private static knownSessions: Set<string> = new Set();

  async ensureSessionExists(sessionId: string, userId: string, initialMessage?: string): Promise<void> {
    const title = initialMessage ? (initialMessage.length > 30 ? initialMessage.slice(0, 30) + '...' : initialMessage) : 'New Conversation';
    
    if (SessionService.knownSessions.has(sessionId)) {
      Promise.resolve(
        this.supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId)
      ).catch(() => {});
      return;
    }

    // Check if session exists first
    const { data: existing } = await this.supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!existing) {
      await this.supabase
        .from('chat_sessions')
        .insert({
          id: sessionId,
          user_id: userId,
          title,
          updated_at: new Date().toISOString(),
        });
    }
    SessionService.knownSessions.add(sessionId);
  }

  async saveMessage(sessionId: string, role: 'user' | 'assistant', content: string, uiData?: any): Promise<void> {
    if (!content && !uiData) return;
    
    await this.supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role,
        content: content || '',
        ui_data: uiData || null,
      });
  }
}
