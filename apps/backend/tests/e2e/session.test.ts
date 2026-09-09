import { describe, it, expect, vi } from 'vitest';
import { SessionService, chatSessionTitle } from '../../src/services/chat/session.service.js';
import { query } from '../helpers/database.js';
describe('Session ownership and durable history', () => {
    it('rejects reused session owned by someone else', async () => {
        const db = { from: vi.fn(() => query({ data: { id: 'session', user_id: 'other' }, error: null })) };
        await expect(new SessionService(db as any).ensureSessionExists('session', 'owner')).rejects.toThrow('not found');
        expect(db.from).toHaveBeenCalledTimes(1);
    });
    it('checks ownership before reading or inserting messages', async () => {
        const db = { from: vi.fn(() => query({ data: null, error: null })) };
        const service = new SessionService(db as any);
        await expect(service.getSessionMessages('foreign', 'owner')).rejects.toThrow('not found');
        await expect(service.saveMessage('foreign', 'user', 'malicious', undefined, 'owner')).rejects.toThrow('not found');
        expect(db.from.mock.calls.flat()).not.toContain('chat_messages');
    });
    it('reports persistence failure', async () => {
        const db = { from: vi.fn((table: string) => query(table === 'chat_sessions' ? { data: { id: 'owned' }, error: null } : { data: null, error: { message: 'offline' } })) };
        await expect(new SessionService(db as any).saveMessage('owned', 'user', 'hello', undefined, 'owner')).rejects.toThrow('persist');
    });
    it('uses the first user message as a concise session title', async () => {
        const reader = { from: vi.fn(() => query({ data: null, error: null })) };
        const writerQuery = query({ data: null, error: null });
        const writer = { from: vi.fn(() => writerQuery) };
        await new SessionService(reader as any, writer as any).ensureSessionExists('session', 'owner', '  How   can I block my debit card?  ');
        expect(writerQuery.insert).toHaveBeenCalledWith({ id: 'session', user_id: 'owner', title: 'How can I block my debit card?' });
        expect(chatSessionTitle('A very long question about retrieving transactions from my savings account for the previous financial year')).toBe('A very long question about retrieving transactions from my…');
    });
});
