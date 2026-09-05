import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import { createChatRoute } from '@/routes/chat.js';
import type { ActiveWorkflowState } from '@boit/types';

let mockSessionState: ActiveWorkflowState | null = null;
const mockTransactions: any[] = [];
const mockAccounts = [
  { id: 'acc-1', account_number: 'AE123456789', balance: 5000, currency: 'AED', type: 'CURRENT', status: 'ACTIVE' },
];

const createMockSupabase = () => ({
  from: vi.fn((table: string) => {
    if (table === 'chat_messages') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }), insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })), delete: vi.fn().mockReturnThis() };
    if (table === 'chat_sessions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
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
        upsert: vi.fn().mockImplementation((val) => {
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
    if (table === 'customer_profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'cust-123', user_id: 'user-123' },
          error: null,
        }),
      };
    }
    if (table === 'bank_accounts') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAccounts[0], error: null }),
        update: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
          then: (resolve: any) => resolve({ error: null }),
        })),
      };
    }
    if (table === 'transactions') {
      return {
        insert: vi.fn().mockImplementation((val) => {
          mockTransactions.push(val);
          return Promise.resolve({ data: val, error: null });
        }),
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

describe('Fastify Network Boundary - Statement Generation Workflow E2E (TDD)', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    mockSessionState = null;
    mockTransactions.length = 0;
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

  it('should start statement workflow and suspend asking for fee acceptance', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Get my statement',
        sessionId: 'test-session-stmt-1',
        history: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    expect(mockSessionState).not.toBeNull();
    expect(mockSessionState?.workflow_type).toBe('statement-workflow');
    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');

    const chunks = response.payload.split('\n\n').filter(Boolean);
    const suspendChunk = chunks.find(c => c.includes('25 AED'));
    expect(suspendChunk).toBeDefined();
  });

  it('should resume workflow on fee acceptance, deduct 25 AED, and stream STATEMENT_CARD payload', async () => {
    // 1. Start statement request
    await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Get my statement',
        sessionId: 'test-session-stmt-2',
        history: [],
      },
    });

    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');

    // 2. Accept fee
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Yes I accept',
        sessionId: 'test-session-stmt-2',
        history: [],
      },
    });

    expect(response.statusCode).toBe(200);
    const chunks = response.payload.split('\n\n').filter(Boolean);

    // Should include STATEMENT_CARD structured event
    const cardChunk = chunks.find(c => c.includes('STATEMENT_CARD'));
    expect(cardChunk).toBeDefined();
    expect(cardChunk).toContain('.pdf');

    // Should clear active workflow state
    expect(mockSessionState).toBeNull();

    // Should insert fee transaction
    expect(mockTransactions.length).toBe(1);
    expect(mockTransactions[0].amount).toBe(-25);
    expect(mockTransactions[0].category).toBe('FEE');
  });
});
