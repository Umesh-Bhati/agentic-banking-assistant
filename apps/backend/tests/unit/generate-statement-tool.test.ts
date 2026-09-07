import { describe, it, expect, vi } from 'vitest';
import { generateStatementTool } from '../../src/mastra/tools/statements/generate-statement.tool.js';

vi.mock('../../src/lib/shared-supabase.js', () => ({
  getSharedSupabaseClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'bank_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            if (col === 'customer_id') {
              return Promise.resolve({
                data: [
                  { id: 'acc-001', account_number: 'AE2403300000123456789', type: 'CURRENT' },
                  { id: 'acc-002', account_number: 'AE123456789012345678902', type: 'SAVINGS' }
                ],
                error: null,
              });
            }
            if (col === 'id') {
              return {
                single: vi.fn().mockResolvedValue({
                  data: { account_number: 'AE2403300000123456789' },
                  error: null,
                })
              };
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
      }
      return {};
    }),
  })),
}));

// Helper to create a mock requestContext with userId
const createMockContext = (userId: string) => ({
  requestContext: {
    get: (key: string) => key === 'userId' ? userId : undefined,
  },
});

describe('generateStatementTool Unit Tests', () => {
  it('should reject execution if feeAccepted is false', async () => {
    const result = await generateStatementTool.execute({
      accountId: 'acc-001',
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
      feeAccepted: false,
    }, createMockContext('customer-001') as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('fee of 25 AED applies');
  });

  it('should generate statement for a specified accountId', async () => {
    const result = await generateStatementTool.execute({
      accountId: 'acc-001',
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
      feeAccepted: true,
    }, createMockContext('customer-001') as any);

    expect(result.success).toBe(true);
    expect(result.url).toContain('accountId=acc-001');
    expect(result.accountNumber).toBe('AE2403300000123456789');
  });
});
