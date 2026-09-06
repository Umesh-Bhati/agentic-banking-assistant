import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';

// Mock Supabase before loading routes
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '7b0cddc1-fa5c-4fd1-91e9-665f45b9d273', email: 'john.doe@gmail.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'chat_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'sess-1',
                user_id: '7b0cddc1-fa5c-4fd1-91e9-665f45b9d273',
                title: 'Card Block Request',
                created_at: '2026-09-01T10:00:00Z',
                updated_at: '2026-09-01T10:05:00Z',
              },
            ],
            error: null,
          }),
          delete: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'sess-1' }, error: null }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'chat_messages') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'msg-1', session_id: 'sess-1', role: 'user', content: 'Block card' },
              { id: 'msg-2', session_id: 'sess-1', role: 'assistant', content: 'Select card' },
            ],
            error: null,
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }, error: null }),
      };
    }),
  })),
}));

vi.mock('../../src/mastra/index.js', () => ({
  mastra: {
    getAgent: vi.fn(() => ({
      stream: vi.fn().mockResolvedValue({
        textStream: (async function* () {
          yield 'Session response stream';
        })(),
      }),
    })),
  },
}));

import { createChatRoute } from '../../src/routes/chat.js';
import authPlugin from '../../src/plugins/auth.plugin.js';

describe('Chat Session Endpoints E2E', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify();
    await app.register(authPlugin, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });
    await createChatRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
      openaiApiKey: 'test-key',
      openrouterApiKey: 'test-key',
    });
    await app.ready();
  });

  it('should fetch user sessions via GET /api/chat/sessions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/sessions',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].title).toBe('Card Block Request');
  });

  it('should fetch session messages via GET /api/chat/sessions/:id/messages', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/sessions/sess-1/messages',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0].content).toBe('Block card');
  });

  it('should delete a session via DELETE /api/chat/sessions/:id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/chat/sessions/sess-1',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });
});
