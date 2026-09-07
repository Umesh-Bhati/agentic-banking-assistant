import { ActionRepository } from '../../repositories/action.repository.js';
import { ActionState, PendingAction } from '@boit/shared-types';
import { CardService } from '../banking/card.service.js';

export class ActionService {
  constructor(
    private actionRepo: ActionRepository,
    private cardService: CardService
  ) {}

  private validateOwnership(action: PendingAction | null, actionId: string, userId: string): PendingAction {
    if (!action) {
      throw new Error(`Action '${actionId}' not found in database.`);
    }

    const isOwner =
      action.userId === userId ||
      action.metadata?.authUserId === userId ||
      action.metadata?.customerId === userId;

    if (!isOwner) {
      throw new Error(`Unauthorized: User '${userId}' does not own action '${actionId}'.`);
    }

    return action;
  }

  async createBlockCardAction(userId: string): Promise<PendingAction> {
    return this.actionRepo.create({
      userId,
      actionType: 'BLOCK_CARD',
      status: ActionState.PENDING_SELECTION,
    });
  }

  async selectCardForBlock(actionId: string, cardId: string, userId: string): Promise<PendingAction> {
    const rawAction = await this.actionRepo.getById(actionId);
    const action = this.validateOwnership(rawAction, actionId, userId);

    if (action.status !== ActionState.PENDING_SELECTION && action.status !== ActionState.PENDING_AUTHORIZATION && action.status !== ActionState.PENDING_CONFIRMATION) {
      throw new Error(`Invalid state transition from ${action.status}`);
    }
    
    return this.actionRepo.updateStatus(actionId, ActionState.PENDING_CONFIRMATION, { cardId });
  }
  
  async confirmAction(actionId: string, userId: string): Promise<PendingAction> {
    const rawAction = await this.actionRepo.getById(actionId);
    const action = this.validateOwnership(rawAction, actionId, userId);

    if (action.status !== ActionState.PENDING_CONFIRMATION && action.status !== ActionState.PENDING_AUTHORIZATION) {
      throw new Error(`Invalid state transition from ${action.status}`);
    }

    return this.actionRepo.updateStatus(actionId, ActionState.PENDING_AUTHORIZATION);
  }

  async executeBlockCardAction(actionId: string, userId: string): Promise<{ success: boolean, message: string }> {
    const rawAction = await this.actionRepo.getById(actionId);
    const action = this.validateOwnership(rawAction, actionId, userId);

    if (action.status !== ActionState.AUTHORIZED) {
      throw new Error(`Invalid state transition from ${action.status}`);
    }
    
    await this.actionRepo.updateStatus(actionId, ActionState.PROCESSING);

    try {
      const cardId = action.metadata?.cardId;
      if (!cardId) throw new Error('No card selected for block');

      const result = await this.cardService.blockCard(cardId, userId);
      
      await this.actionRepo.updateStatus(actionId, ActionState.COMPLETED);
      return result;
    } catch (e) {
      await this.actionRepo.updateStatus(actionId, ActionState.FAILED, { error: e instanceof Error ? e.message : 'Unknown error' });
      throw e;
    }
  }
}
