import { ActionRepository } from '../../repositories/action.repository.js';
import { ActionState, PendingAction } from '@boit/shared-types';
import { CardService } from '../banking/card.service.js';
export class ActionService {
    constructor(private actionRepo: ActionRepository, private cardService: CardService) {
    }
    async owned(actionId: string, customerId: string): Promise<PendingAction> {
        const action = await this.actionRepo.getById(actionId);
        if (!action || action.customerId !== customerId)
            throw new Error('Action not found');
        return action;
    }
    async createBlockCardAction(customerId: string, authUserId?: string): Promise<PendingAction> {
        if (!authUserId)
            throw new Error('Authenticated principal required');
        return this.actionRepo.create({ userId: customerId, customerId, authUserId, actionType: 'BLOCK_CARD', status: ActionState.PENDING_SELECTION });
    }
    async selectCardForBlock(actionId: string, cardId: string, customerId: string): Promise<PendingAction> {
        const action = await this.owned(actionId, customerId);
        const cards = await this.cardService.getUserCards(customerId);
        if (!cards.some(card => card.id === cardId))
            throw new Error('Card not found');
        return this.actionRepo.updateStatus(actionId, ActionState.PENDING_CONFIRMATION, { cardId }, action);
    }
    async confirmAction(actionId: string, customerId: string): Promise<PendingAction> {
        const action = await this.owned(actionId, customerId);
        return this.actionRepo.updateStatus(actionId, ActionState.PENDING_AUTHORIZATION, undefined, action);
    }
    async cancelAction(actionId: string, customerId: string) {
        const action = await this.owned(actionId, customerId);
        if (action.status === ActionState.CANCELLED)
            return action;
        return this.actionRepo.updateStatus(actionId, ActionState.CANCELLED, undefined, action);
    }
    async executeBlockCardAction(actionId: string, customerId: string): Promise<{
        success: boolean;
        message: string;
    }> {
        const action = await this.owned(actionId, customerId);
        const result = await this.actionRepo.rpc('execute_card_block', { p_action_id: actionId, p_user_id: action.authUserId, p_customer_id: customerId, p_expected_version: action.version });
        if (result.status !== ActionState.COMPLETED)
            throw new Error('Action did not complete');
        return { success: true, message: 'Your card has been blocked.' };
    }
}
