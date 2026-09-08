import { FastifyInstance, FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { ActionState, PendingAction } from '@boit/shared-types';
import { ActionRepository } from '../repositories/action.repository.js';
import { ActionService } from '../services/actions/action.service.js';
import { AuthorizationService, AuthorizationCommitError } from '../services/actions/authorization.service.js';
import { CardService } from '../services/banking/card.service.js';
import { PreferenceAuthorizationService } from '../services/actions/preference-authorization.service.js';
import { clientOptions } from '../lib/shared-supabase.js';
type ActionParams = {
    actionId: string;
};
export async function createActionRoutes(fastify: FastifyInstance, config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
}) {
    const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, clientOptions);
    const repository = new ActionRepository(admin);
    const service = (request: FastifyRequest) => new ActionService(repository, new CardService(request.database));
    async function execute(request: FastifyRequest, action: PendingAction) {
        if (action.actionType === 'GENERATE_STATEMENT') {
            const { data, error } = await admin.rpc('confirm_statement', {
                p_statement_id: action.metadata?.statementId,
                p_user_id: request.userId,
                p_customer_id: request.customerId,
            });
            if (error || !data)
                throw new Error('Statement execution failed');
            return { success: true, message: 'Statement issued.', statementId: action.metadata?.statementId };
        }
        if (action.actionType !== 'BLOCK_CARD')
            throw new Error('Unsupported operation');
        return service(request).executeBlockCardAction(action.id, request.customerId);
    }
    fastify.get<{
        Params: ActionParams;
    }>('/actions/:actionId', async (request) => ({
        action: await service(request).owned(request.params.actionId, request.customerId),
    }));
    fastify.post<{
        Params: ActionParams;
    }>('/actions/:actionId/cancel', async (request) => ({
        action: await service(request).cancelAction(request.params.actionId, request.customerId),
    }));
    fastify.post<{
        Params: ActionParams;
        Body: {
            factorId?: string;
        };
    }>('/actions/:actionId/challenge', async (request) => {
        const settings = await new PreferenceAuthorizationService(admin, repository).settings(request.principal);
        if (settings.method !== 'TOTP') return new PreferenceAuthorizationService(admin, repository).challenge(request.params.actionId, request.principal);
        if (!request.body?.factorId)
            throw new Error('Factor required');
        return new AuthorizationService(repository, admin).challenge(request.params.actionId, request.principal, request.body.factorId, request.database);
    });
    for (const path of ['/actions/:actionId/select-and-confirm', '/actions/:actionId/confirm']) {
        fastify.post<{
            Params: ActionParams;
            Body: {
                cardId?: string;
            };
        }>(path, async (request) => {
            const actions = service(request);
            if (request.body?.cardId)
                await actions.selectCardForBlock(request.params.actionId, request.body.cardId, request.customerId);
            const action = await actions.confirmAction(request.params.actionId, request.customerId);
            return { success: true, action };
        });
    }
    fastify.post<{
        Params: ActionParams;
        Body: {
            challengeId?: string;
            code?: string;
            pin?: string;
            biometricToken?: string;
            signature?: string;
            password?: string;
        };
    }>('/actions/:actionId/authorize', async (request) => {
        const credentials = request.body || {};
        if (credentials.biometricToken || credentials.password || !credentials.challengeId || !(/^\d{6}$/.test(credentials.code || '') || /^\d{6}$/.test(credentials.pin || '') || /^[0-9a-f]{128}$/.test(credentials.signature || ''))) {
            throw new Error('Server-verified PIN, biometric signature or TOTP challenge required');
        }
        const actions = service(request);
        const current = await actions.owned(request.params.actionId, request.customerId);
        // Recover an acknowledged authorization after response loss without reusing a consumed OTP.
        if (current.status === ActionState.COMPLETED || current.status === ActionState.AUTHORIZED) {
            const executionResult = await execute(request, current);
            return { success: true, action: await actions.owned(current.id, request.customerId), executionResult };
        }
        const authorization = new AuthorizationService(repository, admin);
        let verified;
        try {
            const preferences = new PreferenceAuthorizationService(admin, repository);
            const settings = await preferences.settings(request.principal);
            verified = settings.method === 'TOTP'
                ? await authorization.authorizeAction(current.id, request.customerId, credentials, request.principal, request.database)
                : await preferences.authorize(current.id, request.principal, { ...credentials, challengeId: credentials.challengeId! });
        } catch (error) {
            if (error instanceof AuthorizationCommitError) {
                return {success:false,action:current,executionResult:{success:false,message:'Check action status before retrying.'},...error.session};
            }
            throw error;
        }
        const {action, session} = verified;
        let executionResult;
        try {
            executionResult = await execute(request, action);
        } catch {
            request.log.warn({event:'banking_execution_unconfirmed',actionType:action.actionType},'Banking execution unconfirmed');
            // MFA rotated the session even if execution failed. Preserve those tokens and report no success.
            return {success:false,action,executionResult:{success:false,message:'Check action status before retrying.'},...session};
        }
        request.log.info({ event: 'banking_action_completed', actionType: action.actionType }, 'Banking action completed');
        return { success: true, action: await actions.owned(action.id, request.customerId), executionResult, ...session };
    });
    fastify.post<{
        Params: ActionParams;
    }>('/actions/:actionId/execute', async (request) => {
        const action = await service(request).owned(request.params.actionId, request.customerId);
        return execute(request, action);
    });
}
