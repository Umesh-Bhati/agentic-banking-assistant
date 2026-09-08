import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { toolContext, resolveAlias, privateResult } from '../context.js';
export const getTransactionsTool = createTool({ id: 'get-transactions', description: 'Show recent transactions securely using an account alias.', inputSchema: z.object({ accountId: z.string(), limit: z.number().int().min(1).max(100).default(7), fromDate: z.string().optional(), toDate: z.string().optional() }), execute: async ({ accountId, limit, fromDate, toDate }, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const items = await new AccountService(c.database).getTransactions(c.principal.customerId, resolveAlias(c, accountId), limit, fromDate, toDate);
        return privateResult(c, 'transactions', items);
    } });
