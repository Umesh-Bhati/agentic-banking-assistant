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
    if (table === 'bank_accounts') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
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
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
    };
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

describe('Regression: "yes" should accept fee, not cancel workflow', () => {
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

  it('should NOT cancel workflow when user says "yes" to accept fee', async () => {
    // Regression: Previously, LLM classified "yes" as CANCEL_WORKFLOW
    // which caused fee acceptance to cancel the workflow instead.
    // Fix: Check active workflow FIRST and handle cancel keywords locally.

    // 1. Start statement request
    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Get my statement',
        sessionId: 'test-session-fee-accept',
        history: [],
      },
    });

    expect(startResponse.statusCode).toBe(200);
    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');

    // 2. User says "yes" - should ACCEPT the fee, NOT cancel
    const acceptResponse = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'yes',
        sessionId: 'test-session-fee-accept',
        history: [],
      },
    });

    expect(acceptResponse.statusCode).toBe(200);
    const chunks = acceptResponse.payload.split('\n\n').filter(Boolean);

    // Should include STATEMENT_CARD event (fee accepted)
    const cardChunk = chunks.find(c => c.includes('STATEMENT_CARD'));
    expect(cardChunk).toBeDefined();
    
    // Should have fee transaction recorded
    expect(mockTransactions.length).toBe(1);
    expect(mockTransactions[0].amount).toBe(-25);

    // Workflow should be cleared after success
    expect(mockSessionState).toBeNull();
  });

  it('should cancel workflow when user explicitly says "cancel"', async () => {
    // 1. Start statement request
    await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Get my statement',
        sessionId: 'test-session-explicit-cancel',
        history: [],
      },
    });

    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');

    // 2. User explicitly says "cancel"
    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'cancel',
        sessionId: 'test-session-explicit-cancel',
        history: [],
      },
    });

    const chunks = cancelResponse.payload.split('\n\n').filter(Boolean);
    const cancelChunk = chunks.find(c => c.includes('Workflow cancelled'));
    expect(cancelChunk).toBeDefined();
    expect(mockSessionState).toBeNull();
  });
});
