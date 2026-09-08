import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { toolContext } from '../context.js';
import { ActionService } from '../../../services/actions/action.service.js';
import { ActionRepository } from '../../../repositories/action.repository.js';
import { CardService } from '../../../services/banking/card.service.js';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';
export const initiateCardBlockTool = createTool({ id: 'initiate-card-block', description: 'Propose a card block and display server-owned selection. Does not confirm or execute.', inputSchema: z.object({}), execute: async (_params, { requestContext }: any) => {
        if (process.env.BANKING_MUTATIONS_ENABLED !== 'true')
            throw new Error('Banking mutations are disabled');
        const c = toolContext(requestContext);
        const cardsService = new CardService(c.database);
        const action = await new ActionService(new ActionRepository(getSharedSupabaseClient()), cardsService).createBlockCardAction(c.principal.customerId, c.principal.authUserId);
        const cards = (await cardsService.getUserCards(c.principal.customerId)).map(card => ({ id: card.id, type: card.card_type, last4: card.last_4 }));
        await c.emit({ type: 'CARD_SELECTION', data: { actionId: action.id, actionType: 'BLOCK_CARD', cards } });
        return { displayed: true, message: 'Customer must use the secure selection and authorization controls.' };
    } });
