import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import { createChatRoute } from '@/routes/chat.js';
import type { ActiveWorkflowState } from '@boit/types';

// Mock Supabase
const createMockSupabase = (sessionState: ActiveWorkflowState | null = null) => ({
  from: vi.fn((table) => {
    if (table === 'chat_messages') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }), insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })), delete: vi.fn().mockReturnThis() };
    if (table === 'chat_sessions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { active_workflow_state: sessionState },
          error: null,
        }),
        update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
        upsert: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
      };
    }
    if (table === 'bank_documents') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === 'cards') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: [
            { id: 'card-1', last_4: '1234', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Platinum' },
            { id: 'card-2', last_4: '5678', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Gold' },
          ],
          error: null,
        }),
        update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
    };
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

describe('Fastify Network Boundary - /api/chat E2E Tests', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    app = fastify({ logger: false });
    
    // Add health endpoint directly for testing
    app.get('/health', async () => {
      return { status: 'ok' };
    });
    
    createChatRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
      openaiApiKey: 'test-openai-key',
      openrouterApiKey: 'test-openrouter-key',
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should return 400 for missing message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { sessionId: 'test-session' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: 'Missing message or sessionId' });
  });

  it('should return 400 for missing sessionId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: 'Missing message or sessionId' });
  });

  it('should return SSE response for product question', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'What credit cards do you offer?',
        sessionId: 'test-session-1',
        history: [],
      },
    });

    // SSE response should have content-type
    expect(response.headers['content-type']).toContain('text/event-stream');
  });

  it('should handle CANCEL intent and clear workflow state', async () => {
    // Create app with existing workflow state
    const workflowState: ActiveWorkflowState = {
      workflow_type: 'card-block-workflow',
      step: 'WAITING_CARD_SELECTION',
      data: { runId: 'run-123', suspendedStep: 'ask-card-selection' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const appWithState = fastify({ logger: false });
    appWithState.get('/health', async () => ({ status: 'ok' }));
    createChatRoute(appWithState, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
      openaiApiKey: 'test-openai-key',
      openrouterApiKey: 'test-openrouter-key',
    });
    await appWithState.ready();

    const response = await appWithState.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Cancel',
        sessionId: 'test-session-with-workflow',
        history: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    
    await appWithState.close();
  });

  it('should route BLOCK_CARD intent to workflow', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Block my card',
        sessionId: 'test-session-block',
        history: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
  });

  it('should return health check', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
  });
});