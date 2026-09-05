import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStatementWorkflow } from '@/workflows/statement-workflow.js';
import type { StatementWorkflowInput } from '@/workflows/statement-workflow.js';

// Mock Supabase
const mockTransactions: any[] = [];
const mockAccounts = [
  { id: 'acc-1', account_number: 'AE123456789', balance: 5000, currency: 'AED', type: 'CURRENT', status: 'ACTIVE' },
  { id: 'acc-2', account_number: 'AE12345678901', balance: 15000, currency: 'AED', type: 'SAVINGS', status: 'ACTIVE' },
];

let queryHasLimit = false;
const mockBankAccountQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockImplementation(() => {
    queryHasLimit = true;
    return mockBankAccountQuery;
  }),
  single: vi.fn().mockImplementation(() => {
    if (!queryHasLimit && mockAccounts.length > 1) {
      return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Cannot coerce result to single JSON object' } });
    }
    return Promise.resolve({ data: mockAccounts[0], error: null });
  }),
  update: vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: any) => resolve({ error: null }),
  })),
};

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'bank_accounts') {
      queryHasLimit = false;
      return mockBankAccountQuery;
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
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
    };
  }),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('StatementRequestWorkflow - Unit Tests (TDD)', () => {
  let workflow: ReturnType<typeof createStatementWorkflow>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactions.length = 0;
    workflow = createStatementWorkflow({
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct workflow structure', () => {
    expect(workflow.id).toBe('statement-workflow');
    const stepIds = Object.keys(workflow.steps);
    expect(stepIds).toEqual([
      'extract-statement-params',
      'ask-fee-acceptance',
      'deduct-fee-and-generate',
    ]);
  });

  it('should suspend at WAITING_FEE_ACCEPTANCE step when started', async () => {
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        userId: 'cust-123',
        supabaseUrl: 'http://localhost:54321',
        supabaseKey: 'test-key',
      } as StatementWorkflowInput,
    });

    expect(result.status).toBe('suspended');
    expect(result.suspended.flat()).toContain('ask-fee-acceptance');
    
    const payload = result.suspendPayload?.['ask-fee-acceptance'] || result.suspendPayload;
    expect(payload).toBeDefined();
    expect(payload.reason).toContain('25 AED');
    expect(payload.fee).toBe(25);
  });

  it('should deduct fee of 25.00 AED and return STATEMENT_CARD payload when resumed with accepted=true', async () => {
    const { Mastra } = await import('@mastra/core');
    const mastra = new Mastra({
      workflows: { statementWorkflow: workflow },
    });
    const registeredWf = mastra.getWorkflow('statementWorkflow');
    const run = await registeredWf.createRun();

    await run.start({
      inputData: {
        userId: 'cust-123',
        supabaseUrl: 'http://localhost:54321',
        supabaseKey: 'test-key',
      } as StatementWorkflowInput,
    });

    const resumeResult = await run.resume({
      step: 'ask-fee-acceptance',
      resumeData: { accepted: true },
    }) as any;

    expect(resumeResult.status).toBe('success');
    expect(resumeResult.result).toBeDefined();
    expect(resumeResult.result.type).toBe('STATEMENT_CARD');
    expect(resumeResult.result.data.fee).toBe(25);
    expect(resumeResult.result.data.url).toContain('.pdf');

    // Verify transaction insertion
    expect(mockTransactions.length).toBe(1);
    expect(mockTransactions[0].amount).toBe(-25);
    expect(mockTransactions[0].category).toBe('FEE');
  });
});
