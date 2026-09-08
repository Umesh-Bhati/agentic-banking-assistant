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
    constructor(private supabase: SupabaseClient, private writer: SupabaseClient = supabase) {
    }
    async getUserSessions(userId: string): Promise<ChatSessionRow[]> {
        const { data, error } = await this.supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false }).limit(100);
        if (error) {
            throw new Error('Unable to read sessions');
        }
        return data || [];
    }
    async getSessionMessages(sessionId: string, userId?: string): Promise<ChatMessageRow[]> {
        if (!userId)
            throw new Error('Session owner required');
        await this.assertOwner(sessionId, userId);
        const { data, error } = await this.supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false }).limit(40);
        if (error) {
            throw new Error('Unable to read messages');
        }
        return (data || []).reverse();
    }
    async deleteSession(sessionId: string, userId: string): Promise<boolean> {
        await this.assertOwner(sessionId, userId);
        const { error } = await this.writer
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId)
            .eq('user_id', userId);
        if (error) {
            throw new Error('Unable to delete session');
        }
        return true;
    }
    async assertOwner(sessionId: string, userId: string) {
        const { data, error } = await this.supabase.from('chat_sessions').select('id').eq('id', sessionId).eq('user_id', userId).single();
        if (error || !data)
            throw new Error('Session not found');
    }
    async ensureSessionExists(sessionId: string, userId: string, initialMessage?: string): Promise<void> {
        const { data, error } = await this.supabase.from('chat_sessions').select('id,user_id').eq('id', sessionId).maybeSingle();
        if (error)
            throw new Error('Unable to read session');
        if (data) {
            if (data.user_id !== userId)
                throw new Error('Session not found');
            return;
        }
        const { error: insertError } = await this.writer.from('chat_sessions').insert({ id: sessionId, user_id: userId, title: 'Banking conversation' });
        if (insertError)
            throw new Error('Unable to persist session');
    }
    async saveMessage(sessionId: string, role: 'user' | 'assistant', content: string, uiData?: unknown, userId?: string): Promise<void> {
        if (!userId)
            throw new Error('Session owner required');
        await this.assertOwner(sessionId, userId);
        const { error } = await this.writer.from('chat_messages').insert({ session_id: sessionId, role, content, ui_data: uiData || null });
        if (error)
            throw new Error('Unable to persist message');
    }
}
