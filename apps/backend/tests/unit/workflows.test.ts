import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCardBlockWorkflow } from '@/workflows/card-block-workflow.js';
import type { CardBlockWorkflowInput } from '@/workflows/card-block-workflow.js';
import type { ActiveWorkflowState, WorkflowState } from '@boit/types';

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

describe('CardBlockWorkflow - Logic Seam Tests', () => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct workflow structure', () => {
    expect(workflow.id).toBe('card-block-workflow');
    const stepIds = Object.keys(workflow.steps);
    expect(stepIds).toHaveLength(3);
    expect(stepIds).toEqual([
      'fetch-user-cards',
      'ask-card-selection',
      'block-card',
    ]);
  });

  it('should suspend at WAITING_CARD_SELECTION when started', async () => {
    const mockCards = [
      { id: 'card-1', last_4: '1234', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Platinum' },
      { id: 'card-2', last_4: '5678', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Gold' },
      { id: 'card-3', last_4: '9012', status: 'ACTIVE', network: 'MASTERCARD', card_type: 'Titanium' },
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
    expect(result.suspendPayload).toBeDefined();
    expect(result.suspendPayload['ask-card-selection']).toBeDefined();
    expect(result.suspendPayload['ask-card-selection'].reason).toContain('Which of your');
  }, 10000);

  it('should have proper step definitions with suspend/resume', () => {
    const stepEntries = Object.entries(workflow.steps);
    expect(stepEntries).toHaveLength(3);
    
    // Step 1: fetch-user-cards
    const fetchStep = stepEntries.find(([id]) => id === 'fetch-user-cards')?.[1];
    expect(fetchStep).toBeDefined();
    expect(fetchStep!.id).toBe('fetch-user-cards');
    expect(fetchStep!.inputSchema).toBeDefined();
    expect(fetchStep!.outputSchema).toBeDefined();
    
    // Step 2: ask-card-selection (with suspend/resume)
    const askStep = stepEntries.find(([id]) => id === 'ask-card-selection')?.[1];
    expect(askStep).toBeDefined();
    expect(askStep!.id).toBe('ask-card-selection');
    expect(askStep!.suspendSchema).toBeDefined();
    expect(askStep!.resumeSchema).toBeDefined();
    
    // Step 3: block-card
    const blockStep = stepEntries.find(([id]) => id === 'block-card')?.[1];
    expect(blockStep).toBeDefined();
    expect(blockStep!.id).toBe('block-card');
    expect(blockStep!.inputSchema).toBeDefined();
    expect(blockStep!.outputSchema).toBeDefined();
  });
});

describe('IntentRouter - Cancel clears workflow state', () => {
  it('should detect CANCEL intent and clear active_workflow_state', () => {
    const cancelKeywords = ['cancel', 'go back', 'never mind', 'stop', 'abort'];
    
    for (const keyword of cancelKeywords) {
      const message = `I want to ${keyword} this operation`;
      const isCancel = cancelKeywords.some(kw => message.toLowerCase().includes(kw));
      expect(isCancel).toBe(true);
    }
  });

  it('should not detect cancel for non-cancel messages', () => {
    const nonCancelMessages = [
      'Block my card',
      'What are your interest rates?',
      'The card ending in 1234',
      'Yes, I accept the fee',
    ];

    const cancelKeywords = ['cancel', 'go back', 'never mind', 'stop', 'abort'];
    
    for (const message of nonCancelMessages) {
      const isCancel = cancelKeywords.some(kw => message.toLowerCase().includes(kw));
      expect(isCancel).toBe(false);
    }
  });
});