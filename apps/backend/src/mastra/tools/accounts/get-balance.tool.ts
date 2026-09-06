import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const getBalanceTool = createTool({
  id: 'get-balance',
  description: 'Retrieve the balance for a specific account or the primary account.',
  inputSchema: z.object({
    accountId: z.string().optional().describe('Optional ID of the account to check'),
  }),
  execute: async ({ accountId }, { requestContext }: any) => {
    const supabase = getSharedSupabaseClient();
    const accountService = new AccountService(supabase);
    const userId = requestContext?.get('userId') as string || 'cus_123';
    return await accountService.getBalance(userId, accountId);
  },
});
