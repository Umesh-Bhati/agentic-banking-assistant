import { randomUUID } from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { ActionState, PendingAction } from '@boit/shared-types';
export class ActionRepository {
    constructor(readonly supabase?: SupabaseClient) {
    }
    private db() {
        if (!this.supabase)
            throw new Error('Durable action storage unavailable');
        return this.supabase;
    }
    async create(action: Omit<PendingAction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PendingAction> {
        if (!action.authUserId || !action.customerId)
            throw new Error('Authenticated principal required');
        const { data, error } = await this.db().from('pending_actions').insert({ id: randomUUID(), user_id: action.authUserId, customer_id: action.customerId, action_type: action.actionType, status: action.status, metadata: action.metadata || {}, idempotency_key: randomUUID() }).select().single();
        if (error || !data)
            throw new Error('Unable to persist action');
        return this.mapRow(data);
    }
    async getById(id: string): Promise<PendingAction | null> {
        const { data, error } = await this.db().from('pending_actions').select('*').eq('id', id).maybeSingle();
        if (error)
            throw new Error('Unable to read action');
        return data ? this.mapRow(data) : null;
    }
    async updateStatus(id: string, status: ActionState, metadata?: Record<string, unknown>, expected?: PendingAction): Promise<PendingAction> {
        const action = expected || await this.getById(id);
        if (!action)
            throw new Error('Action not found');
        return this.rpc('transition_action', { p_action_id: id, p_user_id: action.authUserId, p_customer_id: action.customerId, p_expected_version: action.version, p_status: status, p_metadata: metadata ? { ...action.metadata, ...metadata } : action.metadata || {} });
    }
    async rpc(name: string, args: Record<string, unknown>): Promise<PendingAction> {
        const { data, error } = await this.db().rpc(name, args);
        if (error || !data)
            throw new Error('Action transition rejected');
        return this.mapRow(Array.isArray(data) ? data[0] : data);
    }
    mapRow(row: any): PendingAction {
        return { id: row.id, userId: row.customer_id, authUserId: row.user_id, customerId: row.customer_id, version: row.version, expiresAt: row.expires_at, result: row.result, actionType: row.action_type, status: row.status, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at };
    }
}
