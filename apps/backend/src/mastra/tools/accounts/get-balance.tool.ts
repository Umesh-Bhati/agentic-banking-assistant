import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { toolContext, resolveAlias, privateResult } from '../context.js';
export const getBalanceTool = createTool({ id: 'get-balance', description: 'Show balance securely.', inputSchema: z.object({ accountId: z.string().optional() }), execute: async ({ accountId }, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const items = await [await new AccountService(c.database).getBalance(c.principal.customerId, resolveAlias(c, accountId))];
        return privateResult(c, 'balance', items);
    } });
