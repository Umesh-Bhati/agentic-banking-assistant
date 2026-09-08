import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AccountService } from '../../../services/banking/account.service.js';
import { toolContext, resolveAlias, privateResult } from '../context.js';
export const getAccountsTool = createTool({ id: 'get-accounts', description: 'Show the customer accounts securely.', inputSchema: z.object({}), execute: async (_params, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const items = await new AccountService(c.database).getAccounts(c.principal.customerId);
        return privateResult(c, 'accounts', items);
    } });
