import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';

// Mock Supabase before loading chat route
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '7b0cddc1-fa5c-4fd1-91e9-665f45b9d273', email: 'john.doe@gmail.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }, error: null }),
    })),
  })),
}));

vi.mock('../../src/mastra/index.js', () => ({
  mastra: {
    getAgent: vi.fn(() => ({
      stream: vi.fn().mockResolvedValue({
        textStream: (async function* () {
          yield 'Hello, how can I help you?';
        })(),
      }),
    })),
  },
}));

import { createChatRoute } from '../../src/routes/chat.js';
import authPlugin from '../../src/plugins/auth.plugin.js';

describe('Chat SSE Route E2E', () => {
  it('should stream response chunks via SSE', async () => {
    const app = fastify();
    await app.register(authPlugin, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test',
    });
    await createChatRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test',
      openaiApiKey: 'test',
      openrouterApiKey: 'test',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'Hi', sessionId: 'sess-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.payload).toContain('data: {"type":"text","content":"Hello, how can I help you?"}');
    expect(res.payload).toContain('data: {"type":"done"}');
  });

  it('should return 400 when missing required fields', async () => {
    const app = fastify();
    await app.register(authPlugin, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test',
    });
    await createChatRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test',
      openaiApiKey: 'test',
      openrouterApiKey: 'test',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'Hi' },
    });

    expect(res.statusCode).toBe(400);
  });
});
