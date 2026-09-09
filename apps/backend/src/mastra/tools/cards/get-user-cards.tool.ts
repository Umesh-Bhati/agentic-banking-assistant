import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { CardService } from '../../../services/banking/card.service.js';
import { toolContext, resolveAlias, privateResult } from '../context.js';
import { emptyInputSchema, privateDisplayOutputSchema } from '../../tool-schemas.js';
export const getUserCardsTool = createTool({ id: 'get-user-cards', description: 'Show active cards securely.', inputSchema: emptyInputSchema, outputSchema: privateDisplayOutputSchema('cards'), execute: async (_params, { requestContext }: any) => {
        const c = toolContext(requestContext);
        const items = await new CardService(c.database).getUserCards(c.principal.customerId);
        return privateResult(c, 'cards', items);
    } });
