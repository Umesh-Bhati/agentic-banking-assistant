import { describe, it, expect, vi } from 'vitest';
import { getTransactionsTool } from '../../src/mastra/tools/accounts/get-transactions.tool.js';

vi.mock('../../src/lib/shared-supabase.js', () => ({
  getSharedSupabaseClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'bank_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', type: 'CURRENT' }],
            error: null,
          }),
        };
      }
      if (table === 'transactions') {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (onfulfilled: any) => Promise.resolve({
            data: [
              {
                id: 'tx-1',
                amount: 150.0,
                type: 'DEBIT',
                description: 'Supermarket',
                created_at: '2026-08-15T10:00:00Z',
              },
            ],
            error: null,
          }).then(onfulfilled),
        };
        return builder;
      }
      return {};
    }),
  })),
}));

describe('getTransactionsTool Unit Tests', () => {
  it('should fetch recent transactions without requiring fees or statement generation', async () => {
    const result = await getTransactionsTool.execute({ limit: 5 }, {} as any);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.transactions[0].description).toBe('Supermarket');
  });

  it('should default to limit 7 for max last 7 days transactions', async () => {
    const result = await getTransactionsTool.execute({}, {} as any);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });
});

