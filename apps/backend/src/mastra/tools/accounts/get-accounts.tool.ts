import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const getAccountsTool = createTool({
  id: 'get-accounts',
  description: 'Retrieve a list of bank accounts for the user.',
  inputSchema: z.object({}),
  execute: async (params, { requestContext }: any) => {
    const supabase = getSharedSupabaseClient();
    const accountService = new AccountService(supabase);
    const userId = requestContext?.get('userId') as string || 'cus_123';
    return await accountService.getAccounts(userId);
  },
});
