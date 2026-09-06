import { describe, it, expect, beforeEach } from 'vitest';
import { ActionRepository } from '../../src/repositories/action.repository.js';
import { ActionState } from '@boit/shared-types';

describe('ActionRepository', () => {
  let repo: ActionRepository;

  beforeEach(() => {
    repo = new ActionRepository();
  });

  it('should create and retrieve an action', async () => {
    const action = await repo.create({
      actionType: 'CARD_BLOCK',
      userId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: ActionState.CREATED,
      metadata: { cardId: 'card-1' },
    });

    expect(action.id).toBeDefined();
    expect(action.id).toMatch(/^act_/);
    expect(action.status).toBe(ActionState.CREATED);
    expect(action.actionType).toBe('CARD_BLOCK');
    expect(action.createdAt).toBeDefined();

    const found = await repo.getById(action.id);
    expect(found).toEqual(action);
  });

  it('should update action status', async () => {
    const action = await repo.create({
      actionType: 'CARD_BLOCK',
      userId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: ActionState.CREATED,
      metadata: {},
    });

    const updated = await repo.updateStatus(action.id, ActionState.PENDING_CONFIRMATION);
    expect(updated.status).toBe(ActionState.PENDING_CONFIRMATION);
    expect(updated.updatedAt).toBeDefined();
  });

  it('should return null for non-existent action', async () => {
    const found = await repo.getById('non-existent');
    expect(found).toBeNull();
  });

  it('should throw when updating non-existent action', async () => {
    await expect(
      repo.updateStatus('non-existent', ActionState.COMPLETED)
    ).rejects.toThrow("Action 'non-existent' not found");
  });
});
