import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const generateStatementTool = createTool({
  id: 'generate-statement',
  description: 'Generate an account statement for a given date range.',
  inputSchema: z.object({
    accountId: z.string().describe('The account/product ID selected by the user to generate a statement for'),
    fromDate: z.string().describe('The start date in YYYY-MM-DD format'),
    toDate: z.string().describe('The end date in YYYY-MM-DD format'),
    feeAccepted: z.boolean().describe('Whether the user has explicitly accepted the 25 AED fee'),
  }),
  execute: async ({ accountId, fromDate, toDate, feeAccepted }, { requestContext }: any) => {
    if (!feeAccepted) {
      return { 
        success: false, 
        message: 'A fee of 25 AED applies to generate a statement. Please ask the user to confirm they accept the fee before generating.' 
      };
    }
    
    let resolvedAccountId = accountId;
    let resolvedAccountNumber = 'AE2403300000123456789';

    try {
      const supabase = getSharedSupabaseClient();
      const userId = requestContext?.get('userId') as string;
      if (!userId) throw new Error('Authentication required: no user context available.');

      if (!resolvedAccountId) {
        const { data: products } = await supabase
          .from('customer_products')
          .select('id, product_number, product_type')
          .eq('customer_id', userId);

        if (products && products.length > 0) {
          const primaryProduct = products.find((p: any) => p.product_type === 'CURRENT_ACCOUNT') || products[0];
          resolvedAccountId = primaryProduct.id;
          resolvedAccountNumber = primaryProduct.product_number;
        } else {
          throw new Error('No products found for this user.');
        }
      } else {
        const { data: prod } = await supabase
          .from('customer_products')
          .select('product_number')
          .eq('id', resolvedAccountId)
          .single();
        if (prod?.product_number) {
          resolvedAccountNumber = prod.product_number;
        }
      }
    } catch (err: any) {
      if (!resolvedAccountId) {
        throw new Error(err.message || 'Failed to resolve product for statement generation.');
      }
    }

    const statementId = `stmt_${Math.random().toString(36).substring(2, 9)}`;
    const baseUrl = process.env.API_URL || '';
    const downloadUrl = baseUrl 
      ? `${baseUrl}/api/statements?accountId=${resolvedAccountId}&fromDate=${fromDate}&toDate=${toDate}`
      : `/api/statements?accountId=${resolvedAccountId}&fromDate=${fromDate}&toDate=${toDate}`;

    return {
      success: true,
      statementId,
      accountNumber: resolvedAccountNumber,
      fromDate,
      toDate,
      fee: 25,
      currency: 'AED',
      url: downloadUrl,
      month: new Date(fromDate).toLocaleString('default', { month: 'long' }),
      message: 'Statement generated successfully.'
    };
  },
});

