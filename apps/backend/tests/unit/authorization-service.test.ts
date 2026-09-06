import { describe, it, expect, beforeEach } from 'vitest';
import { ActionRepository } from '../../src/repositories/action.repository.js';
import { AuthorizationService } from '../../src/services/actions/authorization.service.js';
import { ActionState } from '@boit/shared-types';

describe('AuthorizationService', () => {
  let repo: ActionRepository;
  let authService: AuthorizationService;
  const userId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    repo = new ActionRepository();
    authService = new AuthorizationService(repo);
  });

  it('should authorize action with valid 4-digit PIN', async () => {
    const action = await repo.create({
      actionType: 'CARD_BLOCK',
      userId,
      status: ActionState.PENDING_AUTHORIZATION,
    });

    const result = await authService.authorizeAction(action.id, userId, { pin: '1234' });
    expect(result.status).toBe(ActionState.AUTHORIZED);
    expect(result.metadata?.authMethod).toBe('PIN');
  });

  it('should authorize action with biometric assertion token', async () => {
    const action = await repo.create({
      actionType: 'CARD_BLOCK',
      userId,
      status: ActionState.PENDING_AUTHORIZATION,
    });

    const result = await authService.authorizeAction(action.id, userId, { biometricToken: 'bio_verified_123456' });
    expect(result.status).toBe(ActionState.AUTHORIZED);
    expect(result.metadata?.authMethod).toBe('BIOMETRIC');
  });

  it('should reject invalid PIN format', async () => {
    const action = await repo.create({
      actionType: 'CARD_BLOCK',
      userId,
      status: ActionState.PENDING_AUTHORIZATION,
    });

    await expect(
      authService.authorizeAction(action.id, userId, { pin: '12' })
    ).rejects.toThrow('Invalid PIN format');
  });

  it('should reject authorization if action is not in PENDING_AUTHORIZATION state', async () => {
    const action = await repo.create({
      actionType: 'CARD_BLOCK',
      userId,
      status: ActionState.CREATED,
    });

    await expect(
      authService.authorizeAction(action.id, userId, { pin: '1234' })
    ).rejects.toThrow(/Cannot authorize action in state/);
  });
});
