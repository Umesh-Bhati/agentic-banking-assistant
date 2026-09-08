import { describe, it, expect, vi } from 'vitest';
import { ActionRepository } from '../../src/repositories/action.repository.js';
import { ActionState } from '@boit/shared-types';
import { query } from '../helpers/database.js';
describe('Durable actions', () => {
    it('never substitutes memory when database is unavailable', async () => {
        const repo = new ActionRepository();
        await expect(repo.getById('action')).rejects.toThrow('Durable');
        await expect(repo.create({ userId: 'customer', customerId: 'customer', authUserId: 'auth', actionType: 'BLOCK_CARD', status: ActionState.PENDING_SELECTION })).rejects.toThrow('Durable');
    });
    it('propagates database insert failure and keeps owner IDs distinct', async () => {
        const q = query({ data: null, error: { message: 'connection failed' } });
        const repo = new ActionRepository({ from: vi.fn(() => q) } as any);
        await expect(repo.create({ userId: 'customer', customerId: 'customer', authUserId: 'auth', actionType: 'BLOCK_CARD', status: ActionState.PENDING_SELECTION })).rejects.toThrow('persist');
        expect(q.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'auth', customer_id: 'customer' }));
    });
    it('never masks database read failures as missing records', async () => {
        const repo = new ActionRepository({ from: () => query({ data: null, error: { message: 'offline' } }) } as any);
        await expect(repo.getById('action')).rejects.toThrow('read');
    });
});
