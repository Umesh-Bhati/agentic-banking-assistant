import { describe, it, expect, vi } from 'vitest';
import { ActionService } from '../../src/services/actions/action.service.js';
import { ActionState } from '@boit/shared-types';
describe('Deterministic action ownership', () => {
    const action = { id: 'action', authUserId: 'auth-a', customerId: 'customer-a', userId: 'customer-a', version: 3, status: ActionState.PENDING_SELECTION, metadata: { customerId: 'customer-b', authUserId: 'auth-b' } };
    it('does not trust owner aliases in metadata', async () => {
        const service = new ActionService({ getById: async () => action } as any, {} as any);
        await expect(service.owned('action', 'customer-b')).rejects.toThrow('not found');
    });
    it('rejects another customer card before state mutation', async () => {
        const updateStatus = vi.fn();
        const service = new ActionService({ getById: async () => action, updateStatus } as any, { getUserCards: async () => [{ id: 'owned' }] } as any);
        await expect(service.selectCardForBlock('action', 'foreign', 'customer-a')).rejects.toThrow('Card not found');
        expect(updateStatus).not.toHaveBeenCalled();
    });
    it('passes the observed version to atomic execution', async () => {
        const rpc = vi.fn(async () => ({ ...action, status: ActionState.COMPLETED }));
        const service = new ActionService({ getById: async () => action, rpc } as any, {} as any);
        expect(await service.executeBlockCardAction('action', 'customer-a')).toMatchObject({ success: true });
        expect(rpc).toHaveBeenCalledWith('execute_card_block', { p_action_id: 'action', p_user_id: 'auth-a', p_customer_id: 'customer-a', p_expected_version: 3 });
    });
});
