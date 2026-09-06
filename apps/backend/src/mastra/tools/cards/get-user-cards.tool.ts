import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { CardService } from '../../../services/banking/card.service.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const getUserCardsTool = createTool({
  id: 'get-user-cards',
  description: 'Retrieve a list of active cards for the user. Use this when the user wants to see their cards or before initiating a card block action.',
  inputSchema: z.object({
    userId: z.string().describe('The customer ID of the user'),
  }),
  execute: async (params, { requestContext }: any) => {
    const supabase = getSharedSupabaseClient();
    const cardService = new CardService(supabase);
    const userId = requestContext?.get('userId') as string || 'cus_123'; 
    const cards = await cardService.getUserCards(userId);
    return cards;
  },
});
