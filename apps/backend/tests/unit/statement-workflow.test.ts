import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatementWorkflow } from '../../src/workflows/statement-workflow.js';

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'acc-1', account_number: 'AE123', balance: 1000, currency: 'AED' },
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis().mockResolvedValue({ error: null }),
    })),
  };
});

describe('StatementRequestWorkflow', () => {
  let workflow: ReturnType<typeof createStatementWorkflow>;

  beforeEach(() => {
    workflow = createStatementWorkflow({ supabaseUrl: 'test-url', supabaseServiceKey: 'test-key' });
  });

  it('should have correct workflow structure', () => {
    expect(workflow.id).toBe('statement-workflow');
    const stepIds = Object.keys(workflow.steps);
    expect(stepIds).toEqual(['ask-date-range', 'ask-account-selection', 'ask-fee-acceptance', 'deduct-fee-and-generate']);
  });

  it('should suspend at WAITING_DATE_RANGE step when started', async () => {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { userId: 'u1', supabaseUrl: 's1', supabaseKey: 'k1' } });
    expect(result.status).toBe('suspended');
    expect(result.suspended?.flat()).toContain('ask-date-range');
  });

  it('should flow through to deductor when dates and account and acceptance are given', async () => {
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { userId: 'u1', supabaseUrl: 's1', supabaseKey: 'k1', fromDate: '2026-08-01', toDate: '2026-09-01', accountId: 'acc-1', accepted: true }
    });
    expect(result.status).toBe('success');
  });
});
