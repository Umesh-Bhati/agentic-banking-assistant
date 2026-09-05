import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import { createChatRoute, activeRuns } from '@/routes/chat.js';
import type { ActiveWorkflowState } from '@boit/types';

let mockSessionState: ActiveWorkflowState | null = null;
const mockAccounts = [{ id: 'acc-1', account_number: 'AE123456789', balance: 5000, currency: 'AED', type: 'CURRENT', status: 'ACTIVE' }];

const createMockSupabase = () => ({
  from: vi.fn((table: string) => {
    if (table === 'chat_sessions') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockImplementation(() => Promise.resolve({ data: { active_workflow_state: mockSessionState }, error: null })), update: vi.fn().mockImplementation((val) => { if (val && 'active_workflow_state' in val) mockSessionState = val.active_workflow_state; return { eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) }; }), upsert: vi.fn().mockImplementation((val) => { if (val && 'active_workflow_state' in val) mockSessionState = val.active_workflow_state; return { eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) }; }) };
    if (table === 'customer_profiles') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'cust-123', user_id: 'user-123' }, error: null }) };
    if (table === 'bank_accounts') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockAccounts[0], error: null }), update: vi.fn().mockImplementation(() => ({ eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) })) };
    if (table === 'transactions') return { insert: vi.fn().mockImplementation((val) => Promise.resolve({ data: val, error: null })) };
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }) };
  }),
});

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => createMockSupabase()) }));

describe('Workflow Resume After Server Restart', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    mockSessionState = null;
    app = fastify({ logger: false });
    createChatRoute(app, { supabaseUrl: 'http://localhost:54321', supabaseServiceKey: 'test-key', openaiApiKey: 'test-openai-key', openrouterApiKey: 'test-openrouter-key' });
    await app.ready();
  });

  afterEach(async () => { await app.close(); vi.clearAllMocks(); });

  it('should resume statement workflow after server restart', async () => {
    await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'Get my statement', sessionId: 'test-resume' } });
    expect(mockSessionState?.step).toBe('WAITING_DATE_RANGE');
    
    // Simulate server restart
    activeRuns.clear();

    await app.inject({ method: 'POST', url: '/api/chat', payload: { message: 'last month', sessionId: 'test-resume' } });
    expect(mockSessionState?.step).toBe('WAITING_FEE_ACCEPTANCE');
  });
});
