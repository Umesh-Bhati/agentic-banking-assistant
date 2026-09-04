import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import { createChatRoute } from '@/routes/chat.js';
import type { ActiveWorkflowState } from '@boit/types';

let mockSessionState: ActiveWorkflowState | null = null;

// Mock Supabase
const createMockSupabase = () => ({
  from: vi.fn((table) => {
    if (table === 'chat_sessions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({
          data: { active_workflow_state: mockSessionState },
          error: null,
        })),
        update: vi.fn().mockImplementation((val) => {
          if (val && 'active_workflow_state' in val) {
            mockSessionState = val.active_workflow_state;
          }
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
            then: (resolve: any) => resolve({ error: null }),
          };
        }),
      };
    }
    if (table === 'cards') {
      const cardsData = [
        { id: 'card-1', last_4: '1234', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Platinum' },
        { id: 'card-2', last_4: '5678', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Gold' },
      ];
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: cardsData[0], error: null }),
        then: (resolve: any) => resolve({ data: cardsData, error: null }),
      };
      return builder;
    }
    if (table === 'customer_profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'cust-123', user_id: 'user-123' },
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockImplementation((val) => {
        if (val && 'active_workflow_state' in val) {
          mockSessionState = val.active_workflow_state;
        }
        return Promise.resolve({ error: null });
      }),
    };
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

describe('Fastify Network Boundary - Auth Required SSE Signal (TDD)', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    mockSessionState = null;
    app = fastify({ logger: false });
    app.get('/health', async () => ({ status: 'ok' }));
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

  it('should stream auth_required event when workflow suspends at WAITING_FOR_AUTH', async () => {
    // 1. Start workflow with "Block my card"
    await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Block my card',
        sessionId: 'test-session-auth',
        history: [],
      },
    });

    expect(mockSessionState).not.toBeNull();
    expect(mockSessionState?.step).toBe('WAITING_CARD_SELECTION');

    // 2. Provide card selection "1234"
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: '1234',
        sessionId: 'test-session-auth',
        history: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    
    // Should contain auth_required event type
    const chunks = response.payload.split('\n\n').filter(Boolean);
    const authRequiredChunk = chunks.find(c => c.includes('auth_required'));
    expect(authRequiredChunk).toBeDefined();
  });

  it('should include card details in auth_required signal', async () => {
    // 1. Start workflow
    await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Block my card',
        sessionId: 'test-session-auth-2',
        history: [],
      },
    });

    // 2. Select card
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: '1234',
        sessionId: 'test-session-auth-2',
        history: [],
      },
    });

    const chunks = response.payload.split('\n\n').filter(Boolean);
    const authChunk = chunks.find(c => c.includes('auth_required'));
    expect(authChunk).toBeDefined();
    
    // Should include card type and last 4
    expect(authChunk).toContain('Platinum');
    expect(authChunk).toContain('1234');
  });
});