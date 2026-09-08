import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { toolContext, resolveAlias } from '../context.js';
import { quoteStatement } from '../../../routes/statements.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';
export const generateStatementTool = createTool({ id: 'generate-statement', description: 'Display an unconfirmed statement quote. Only explicit secure UI consent can issue a statement or debit a fee.', inputSchema: z.object({ accountId: z.string(), fromDate: z.string(), toDate: z.string() }), execute: async ({ accountId, fromDate, toDate }, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const statement = await quoteStatement(getSharedSupabaseClient(), c.principal.authUserId, c.principal.customerId, resolveAlias(c, accountId)!, fromDate, toDate, randomUUID());
        await c.emit({ type: 'STATEMENT_QUOTE', data: statement });
        return { displayed: true, message: 'Awaiting secure customer confirmation; no fee has been debited.' };
    } });
