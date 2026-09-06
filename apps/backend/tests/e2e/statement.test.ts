import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
import { createStatementRoute } from '../../src/routes/statements.js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'bank_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              account_number: 'AE123456789',
              type: 'CURRENT',
              currency: 'AED',
              customer_profiles: { full_name: 'John Doe' },
            },
            error: null,
          }),
        };
      }

      // Fluently chainable and thenable query builder for transactions
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (onfulfilled: any) => Promise.resolve({
          data: [
            {
              created_at: '2026-08-15T10:00:00Z',
              description: 'Supermarket',
              amount: 150.0,
              type: 'DEBIT',
              currency: 'AED',
            },
          ],
          error: null,
        }).then(onfulfilled),
      };
      return builder;
    }),
  })),
}));

describe('Statement Route E2E', () => {
  it('should generate PDF statement', async () => {
    const app = fastify();
    await createStatementRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/statements?accountId=acc-123&fromDate=2026-08-01&toDate=2026-08-31',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="statement-AE123456789.pdf"');
  });

  it('should return 400 if accountId is missing', async () => {
    const app = fastify();
    await createStatementRoute(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/statements',
    });

    expect(res.statusCode).toBe(400);
  });
});
