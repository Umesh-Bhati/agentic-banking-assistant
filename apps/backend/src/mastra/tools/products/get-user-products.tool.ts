import { AccountService } from '../../../services/banking/account.service.js';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { toolContext, privateResult } from '../context.js';
import { emptyInputSchema, privateDisplayOutputSchema } from '../../tool-schemas.js';
export const getUserProductsTool = createTool({ id: 'get-user-products', description: 'Display supported financial products privately; return aliases for statement quotes.', inputSchema: emptyInputSchema, outputSchema: privateDisplayOutputSchema('products'), execute: async (_params, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const { data, error } = await c.database.from('customer_products').select('id,product_type,product_name,product_number,linked_account_id,currency,status').eq('customer_id', c.principal.customerId).eq('status', 'ACTIVE');
        if (error)
            throw new Error('Unable to read products');
        const accounts = await new AccountService(c.database).getAccounts(c.principal.customerId);
        const products = (data || []).map(product => {
            const account = accounts.find(account => account.id === product.linked_account_id);
            return { ...product, balance: account?.balance };
        });
        return privateResult(c, 'products', products);
    } });
