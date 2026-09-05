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
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: { active_workflow_state: mockSessionState }, error: null })),
        update: vi.fn().mockImplementation((val) => { if (val && 'active_workflow_state' in val) mockSessionState = val.active_workflow_state; return { eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) }; }),
        upsert: vi.fn().mockImplementation((val) => { if (val && 'active_workflow_state' in val) mockSessionState = val.active_workflow_state; return { eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) }; }),
      };
    }
    if (table === 'customer_profiles') { return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'cust-123', user_id: 'user-123' }, error: null }) }; }
    if (table === 'bank_accounts') { return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockAccounts[0], error: null }), update: vi.fn().mockImplementation(() => ({ eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) })) }; }
    if (table === 'transactions') { return { insert: vi.fn().mockImplementation((val) => { mockTransactions.push(val); return Promise.resolve({ data: val, error: null }); }) }; }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }) };
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
});

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => createMockSupabase()) }));

describe('Fastify Network Boundary - Statement Generation Workflow E2E (TDD)', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    mockSessionState = null;
    mockTransactions.length = 0;
    app = fastify({ logger: false });
    app.get('/health', async () => ({ status: 'ok' }));
    createChatRoute(app, { supabaseUrl: 'http://localhost:54321', supabaseServiceKey: 'test-key', openaiApiKey: 'test-openai-key', openrouterApiKey: 'test-openrouter-key' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should start statement workflow and go through questions', async () => {
    await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'Get my statement', sessionId: 'test-session-stmt-1', history: [] } });
    expect(mockSessionState?.step).toBe('WAITING_DATE_RANGE');

    await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'last month', sessionId: 'test-session-stmt-1', history: [] } });
    // skips account selection because only 1 account exists
    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');

    const res = await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'Yes I accept', sessionId: 'test-session-stmt-1', history: [] } });
    const chunks = res.payload.split('\n\n').filter(Boolean);
    const cardChunk = chunks.find(c => c.includes('STATEMENT_CARD'));
    expect(cardChunk).toBeDefined();
    expect(mockSessionState).toBeNull();
    expect(mockTransactions.length).toBe(1);
  });
});
