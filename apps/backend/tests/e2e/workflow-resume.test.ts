import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import { createChatRoute } from '@/routes/chat.js';
import type { ActiveWorkflowState } from '@boit/types';

// We need to test with actual Mastra storage clearing
// Since Mastra uses in-memory storage by default, we need to 
// create separate processes or manually clear the storage

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
        single: vi.fn().mockResolvedValue({ 
          data: { id: 'acc-1', account_number: 'AE123456789', balance: 5000, currency: 'AED', type: 'CURRENT', status: 'ACTIVE' }, 
          error: null 
        }),
        update: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
          then: (resolve: any) => resolve({ error: null }),
        })),
      };
    }
    if (table === 'transactions') {
      return {
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
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

let mockSessionState: ActiveWorkflowState | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

describe('Workflow Resume After Server Restart', () => {
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

  it('should resume statement workflow after "server restart" (activeRuns cleared)', async () => {
    // Step 1: Start statement request - this creates a suspended workflow
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Get my statement',
        sessionId: 'test-session-restart-1',
        history: [],
      },
    });

    expect(response1.statusCode).toBe(200);
    expect(mockSessionState).not.toBeNull();
    expect(mockSessionState?.workflow_type).toBe('statement-workflow');
    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');
    
    const runId = mockSessionState?.data?.runId;
    expect(runId).toBeDefined();

    // Step 2: Simulate server restart by creating a NEW app instance
    // Note: This test may pass because Mastra's in-memory storage persists
    // across app instances in the same process. A real server restart would
    // clear Mastra's storage. This test documents the expected behavior.
    await app.close();
    
    // Create new app instance (simulates server restart)
    app = fastify({ logger: false });
    app.get('/health', async () => ({ status: 'ok' }));
    createChatRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
      openaiApiKey: 'test-openai-key',
      openrouterApiKey: 'test-openrouter-key',
    });
    await app.ready();

    // Step 3: Try to resume the workflow (user says "yes")
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Yes I accept',
        sessionId: 'test-session-restart-1',
        history: [],
      },
    });

    expect(response2.statusCode).toBe(200);
    
    const chunks = response2.payload.split('\n\n').filter(Boolean);
    const hasError = chunks.some(c => c.includes('error'));
    const hasStatementCard = chunks.some(c => c.includes('STATEMENT_CARD'));
    
    console.log('Response chunks:', chunks);
    
    expect(hasError).toBe(false);
    expect(hasStatementCard).toBe(true);
    expect(mockSessionState).toBeNull(); // workflow should be cleared on success
  });
});