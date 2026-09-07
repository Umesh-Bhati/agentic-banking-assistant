import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ActionService } from '../../../services/actions/action.service.js';
import { CardService } from '../../../services/banking/card.service.js';
import { ActionRepository } from '../../../repositories/action.repository.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const initiateCardBlockTool = createTool({
  id: 'initiate-card-block',
  description: 'Initiate a card block workflow. Use this when the user wants to block a card. This tool creates a pending action and returns available cards to render the card selection UI.',
  inputSchema: z.object({}),
  execute: async (params, { requestContext }: any) => {
    const supabase = getSharedSupabaseClient();
    const actionRepo = new ActionRepository(supabase);
    const cardService = new CardService(supabase);
    const actionService = new ActionService(actionRepo, cardService);
    
    // Default demo user ID
    const userId = requestContext?.get('userId') as string;
    if (!userId) throw new Error('Authentication required: no user context available.');
    
    const action = await actionService.createBlockCardAction(userId);
    const cards = await cardService.getUserCards(userId);
    
    return {
      success: true,
      actionId: action.id,
      cards: cards.map(c => ({
        id: c.id,
        type: c.card_type,
        last4: c.last_4
      }))
    };
  },
});
