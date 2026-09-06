import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionRepository } from '../../src/repositories/action.repository.js';
import { ActionService } from '../../src/services/actions/action.service.js';
import { ActionState } from '@boit/shared-types';

describe('ActionService', () => {
  let repo: ActionRepository;
  let mockCardService: any;
  let actionService: ActionService;
  const userId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    repo = new ActionRepository();
    mockCardService = {
      blockCard: vi.fn().mockResolvedValue({ success: true, message: 'Card blocked' }),
    };
    actionService = new ActionService(repo, mockCardService);
  });

  it('should create block card action in PENDING_SELECTION state', async () => {
    const action = await actionService.createBlockCardAction(userId);
    expect(action.status).toBe(ActionState.PENDING_SELECTION);
    expect(action.actionType).toBe('BLOCK_CARD');
  });

  it('should transition PENDING_SELECTION to PENDING_CONFIRMATION when card selected', async () => {
    const action = await actionService.createBlockCardAction(userId);
    const updated = await actionService.selectCardForBlock(action.id, 'card-123', userId);
    expect(updated.status).toBe(ActionState.PENDING_CONFIRMATION);
    expect(updated.metadata?.cardId).toBe('card-123');
  });

  it('should execute card block when in AUTHORIZED state', async () => {
    const action = await actionService.createBlockCardAction(userId);
    await actionService.selectCardForBlock(action.id, 'card-123', userId);
    await actionService.confirmAction(action.id, userId);
    await repo.updateStatus(action.id, ActionState.AUTHORIZED);

    const result = await actionService.executeBlockCardAction(action.id, userId);
    expect(result.success).toBe(true);
    expect(mockCardService.blockCard).toHaveBeenCalledWith('card-123', userId);

    const finalState = await repo.getById(action.id);
    expect(finalState?.status).toBe(ActionState.COMPLETED);
  });
});
