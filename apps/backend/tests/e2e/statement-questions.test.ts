import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify from 'fastify';
import { createChatRoute } from '@/routes/chat.js';
import type { ActiveWorkflowState } from '@boit/types';

let mockSessionState: ActiveWorkflowState | null = null;

const createMockSupabase = () => ({
  from: vi.fn((table: string) => {
    if (table === 'chat_messages') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }), insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })), delete: vi.fn().mockReturnThis() };
    if (table === 'chat_sessions') {
      return {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: { active_workflow_state: mockSessionState }, error: null })),
        upsert: vi.fn().mockImplementation((val) => {
          if (val && 'active_workflow_state' in val) mockSessionState = val.active_workflow_state;
          return { eq: vi.fn().mockResolvedValue({ error: null }), then: (r: any) => r({ error: null }) };
        }),
      };
    }
    if (table === 'customer_profiles') {
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'cust-123', user_id: 'user-123' }, error: null }) };
    }
    if (table === 'bank_accounts') {
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'acc-1', account_number: 'AE123456789', balance: 5000, currency: 'AED', type: 'CURRENT', status: 'ACTIVE' }, error: null }) };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }) };
  }),
});

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => createMockSupabase()) }));

describe('Statement Generation - Questions Loop', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    mockSessionState = null;
    app = fastify({ logger: false });
    createChatRoute(app, { supabaseUrl: 'http://localhost:54321', supabaseServiceKey: 'test-key', openaiApiKey: 'test-openai-key', openrouterApiKey: 'test-openrouter-key' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should suspend asking for date range before fee acceptance', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Get my statement', sessionId: 'test-session-stmt-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockSessionState).not.toBeNull();
    expect(mockSessionState?.workflow_type).toBe('statement-workflow');
    // Expect it to wait for date range instead of fee
    expect(mockSessionState?.step).toBe('WAITING_DATE_RANGE');

    const chunks = response.payload.split('\n\n').filter(Boolean);
    const suspendChunk = chunks.find(c => c.toLowerCase().includes('what time period'));
    expect(suspendChunk).toBeDefined();
  });
});
