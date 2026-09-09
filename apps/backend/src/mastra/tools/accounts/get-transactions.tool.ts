import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { toolContext, resolveAlias, privateResult } from '../context.js';
import { accountAliasSchema, isoDateSchema, privateDisplayOutputSchema } from '../../tool-schemas.js';
export const getTransactionsTool = createTool({ id: 'get-transactions', description: 'Show recent transactions securely using an account alias.', inputSchema: z.object({ accountId: accountAliasSchema, limit: z.number().int().min(1).max(100).default(7), fromDate: isoDateSchema.optional(), toDate: isoDateSchema.optional() }).strict().refine(value => !value.fromDate || !value.toDate || value.fromDate <= value.toDate, { message: 'fromDate must not be after toDate' }), outputSchema: privateDisplayOutputSchema('transactions'), execute: async ({ accountId, limit, fromDate, toDate }, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const items = await new AccountService(c.database).getTransactions(c.principal.customerId, resolveAlias(c, accountId), limit, fromDate, toDate);
        return privateResult(c, 'transactions', items);
    } });
