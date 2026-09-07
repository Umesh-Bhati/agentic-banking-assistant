import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const getTransactionsTool = createTool({
  id: 'get-transactions',
  description: 'Retrieve recent account transactions (max 7 days / limit 7) for the user to display directly in chat without fee or PDF generation.',
  inputSchema: z.object({
    accountId: z.string().optional().describe('The account ID to retrieve transactions for'),
    limit: z.number().optional().default(7).describe('Maximum number of recent transactions to fetch (default 7)'),
    fromDate: z.string().optional().describe('The start date in YYYY-MM-DD format'),
    toDate: z.string().optional().describe('The end date in YYYY-MM-DD format'),
  }),
  execute: async ({ accountId, limit = 7, fromDate, toDate }, { requestContext }: any) => {
    const supabase = getSharedSupabaseClient();
    const accountService = new AccountService(supabase);
    const userId = requestContext?.get('userId') as string;
    if (!userId) throw new Error('Authentication required: no user context available.');

    try {
      const transactions = await accountService.getTransactions(userId, accountId, limit, fromDate, toDate);
      return {
        success: true,
        count: transactions.length,
        transactions,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to fetch transactions',
      };
    }
  },
});
