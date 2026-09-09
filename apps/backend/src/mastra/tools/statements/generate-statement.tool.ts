import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { toolContext, resolveAlias } from '../context.js';
import { quoteStatement } from '../../../routes/statements.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';
import { isoDateSchema, productAliasSchema, secureControlOutputSchema } from '../../tool-schemas.js';
export const generateStatementTool = createTool({ id: 'generate-statement', description: 'Display an unconfirmed statement quote. First call getUserProducts in this request and use its product alias, never a bank-account alias. Only explicit secure UI consent can issue a statement or debit a fee.', inputSchema: z.object({ accountId: productAliasSchema.describe('A fresh products-N alias from getUserProducts, not an accounts-N alias.'), fromDate: isoDateSchema.describe('Statement start date YYYY-MM-DD'), toDate: isoDateSchema.describe('Statement end date YYYY-MM-DD') }).strict().refine(value => value.fromDate <= value.toDate, { message: 'fromDate must not be after toDate' }), outputSchema: secureControlOutputSchema, execute: async ({ accountId, fromDate, toDate }, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const statement = await quoteStatement(getSharedSupabaseClient(), c.principal.authUserId, c.principal.customerId, resolveAlias(c, accountId)!, fromDate, toDate, randomUUID());
        await c.emit({ type: 'STATEMENT_QUOTE', data: statement });
        return { displayed: true as const, message: 'Awaiting secure customer confirmation; no fee has been debited.' };
    } });
