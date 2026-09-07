import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ActionRepository } from '../repositories/action.repository.js';
import { ActionService } from '../services/actions/action.service.js';
import { AuthorizationService } from '../services/actions/authorization.service.js';
import { CardService } from '../services/banking/card.service.js';

export async function createActionRoutes(
  fastify: FastifyInstance, 
  config: { supabaseUrl: string; supabaseServiceKey: string; }
) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  
  const actionRepo = new ActionRepository(supabase);
  const cardService = new CardService(supabase);
  const actionService = new ActionService(actionRepo, cardService);
  const authService = new AuthorizationService(actionRepo, supabase);

  // POST /actions/:actionId/select-and-confirm
  fastify.post('/actions/:actionId/select-and-confirm', async (
    request: FastifyRequest<{ Params: { actionId: string }, Body: { cardId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { actionId } = request.params;
      const userId = request.customerId || request.userId;
      const { cardId } = request.body || {};

      if (!cardId) {
        return reply.code(400).send({ error: 'Card ID is required.' });
      }

      // Step 1: Select the card
      await actionService.selectCardForBlock(actionId, cardId, userId);

      // Step 2: Confirm → moves to PENDING_AUTHORIZATION
      const action = await actionService.confirmAction(actionId, userId);

      // Step 3: Fetch user's configured auth preference
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('auth_preference')
        .eq('id', userId)
        .single();

      return reply.send({
        success: true,
        action,
        authPreference: profile?.auth_preference || 'PIN',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('Unauthorized') ? 403 : 400;
      return reply.code(statusCode).send({ error: msg });
    }
  });

  fastify.post('/actions/:actionId/confirm', async (
    request: FastifyRequest<{ Params: { actionId: string }, Body: { userId?: string, cardId?: string } }>, 
    reply: FastifyReply
  ) => {
    try {
      const { actionId } = request.params;
      const userId = request.customerId || request.userId;
      const cardId = request.body?.cardId;

      let action;
      if (cardId) {
        action = await actionService.selectCardForBlock(actionId, cardId, userId);
      }
      action = await actionService.confirmAction(actionId, userId);
      
      return reply.send({ success: true, action });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('Unauthorized') ? 403 : 400;
      return reply.code(statusCode).send({ error: msg });
    }
  });

  fastify.post('/actions/:actionId/authorize', async (
    request: FastifyRequest<{ Params: { actionId: string }, Body: { userId?: string, pin?: string, biometricToken?: string } }>, 
    reply: FastifyReply
  ) => {
    try {
      const { actionId } = request.params;
      const userId = request.customerId || request.userId;
      const { pin, biometricToken } = request.body || {};

      const action = await authService.authorizeAction(actionId, userId, { pin, biometricToken });
      
      // Auto-execute if authorized
      const executionResult = await actionService.executeBlockCardAction(actionId, userId);

      return reply.send({ success: true, action, executionResult });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('Unauthorized') ? 403 : 400;
      return reply.code(statusCode).send({ error: msg });
    }
  });

  fastify.post('/actions/:actionId/execute', async (
    request: FastifyRequest<{ Params: { actionId: string }, Body: { userId?: string } }>, 
    reply: FastifyReply
  ) => {
    try {
      const { actionId } = request.params;
      const userId = request.customerId || request.userId;
      
      const result = await actionService.executeBlockCardAction(actionId, userId);
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('Unauthorized') ? 403 : 400;
      return reply.code(statusCode).send({ error: msg });
    }
  });
}
