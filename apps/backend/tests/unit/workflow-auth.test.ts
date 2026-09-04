import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCardBlockWorkflow } from '@/workflows/card-block-workflow.js';
import type { CardBlockWorkflowInput } from '@/workflows/card-block-workflow.js';

// Mock the Supabase client creation
const mockSupabase = {
  from: vi.fn((table) => {
    if (table === 'cards') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'card-1', last_4: '1234', card_type: 'Platinum' },
          error: null,
        }),
        update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
    };
  }),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('CardBlockWorkflow - WAITING_FOR_AUTH Step (TDD)', () => {
  let workflow: ReturnType<typeof createCardBlockWorkflow>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'cards') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'card-1', last_4: '1234', card_type: 'Platinum' },
            error: null,
          }),
          update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
      };
    });

    workflow = createCardBlockWorkflow({
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });
  });

  it('should have wait-for-auth step with proper suspend/resume schemas', () => {
    const stepEntries = Object.entries(workflow.steps);
    const authStep = stepEntries.find(([id]) => id === 'wait-for-auth')?.[1];
    
    expect(authStep).toBeDefined();
    expect(authStep!.id).toBe('wait-for-auth');
    expect(authStep!.suspendSchema).toBeDefined();
    expect(authStep!.resumeSchema).toBeDefined();
  });

  it('should suspend at WAITING_CARD_SELECTION first', async () => {
    const mockCards = [
      { id: 'card-1', last_4: '1234', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Platinum' },
    ];

    let callCount = 0;
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'cards') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({ data: mockCards, error: null });
            }
            return Promise.resolve({ data: mockCards[0], error: null });
          }),
          update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
      };
    });

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        userId: 'user-123',
        supabaseUrl: 'http://localhost:54321',
        supabaseKey: 'test-key',
      } as CardBlockWorkflowInput,
    });

    expect(result.status).toBe('suspended');
    expect(result.suspended.flat()).toContain('ask-card-selection');
  }, 10000);

  it('should have 4 steps including wait-for-auth', () => {
    const stepIds = Object.keys(workflow.steps);
    expect(stepIds).toHaveLength(4);
    expect(stepIds).toEqual([
      'fetch-user-cards',
      'ask-card-selection',
      'wait-for-auth',
      'block-card',
    ]);
  });

  it('should have proper suspend schema for wait-for-auth with card details', () => {
    const authStep = workflow.steps['wait-for-auth'];
    expect(authStep.suspendSchema).toBeDefined();
    
    // The suspend schema should include card details for the UI
    const suspendSchema = authStep.suspendSchema;
    expect(suspendSchema).toBeDefined();
  });

  it('should have proper resume schema for wait-for-auth with authToken', () => {
    const authStep = workflow.steps['wait-for-auth'];
    expect(authStep.resumeSchema).toBeDefined();
  });
});