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
                  { id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', account_number: 'AE2403300000123456789', type: 'CURRENT' },
                  { id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', account_number: 'AE123456789012345678902', type: 'SAVINGS' }
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

describe('generateStatementTool Unit Tests', () => {
  it('should reject execution if feeAccepted is false', async () => {
    const result = await generateStatementTool.execute({
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
      feeAccepted: false,
    }, {} as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('fee of 25 AED applies');
  });

  it('should auto-resolve primary CURRENT account when accountId is missing', async () => {
    const result = await generateStatementTool.execute({
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
      feeAccepted: true,
    }, {} as any);

    expect(result.success).toBe(true);
    expect(result.url).toContain('accountId=c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(result.accountNumber).toBe('AE2403300000123456789');
  });
});
