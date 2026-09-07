import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const getUserProductsTool = createTool({
  id: 'get-user-products',
  description: 'Fetch all financial products owned by the authenticated user. Products include bank accounts, credit cards, and loans. Use this when the user asks for a statement to show which product they want a statement for.',
  inputSchema: z.object({}),
  execute: async (params, { requestContext }: any) => {
    const supabase = getSharedSupabaseClient();
    const userId = requestContext?.get('userId') as string;
    if (!userId) throw new Error('Authentication required: no user context available.');

    const { data: products, error } = await supabase
      .from('customer_products')
      .select('id, product_type, product_name, product_number, linked_account_id, linked_card_id, balance, currency, status')
      .eq('customer_id', userId)
      .eq('status', 'ACTIVE');

    if (error) throw new Error(`Failed to fetch products: ${error.message}`);

    return {
      products: (products || []).map(p => ({
        id: p.id,
        type: p.product_type,
        name: p.product_name,
        number: p.product_number,
        linkedAccountId: p.linked_account_id,
        linkedCardId: p.linked_card_id,
        balance: p.balance,
        currency: p.currency,
      })),
    };
  },
});
