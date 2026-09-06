import { SupabaseClient } from '@supabase/supabase-js';
import { ActionState, PendingAction } from '@boit/shared-types';

export class ActionRepository {
  private static sharedInMemoryActions: Map<string, PendingAction> = new Map();

  constructor(private supabase?: SupabaseClient) {}

  async create(action: Omit<PendingAction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PendingAction> {
    const id = `act_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('pending_actions')
        .insert({
          id,
          user_id: action.userId,
          customer_id: action.userId,
          action_type: action.actionType,
          status: action.status || ActionState.CREATED,
          metadata: action.metadata || {},
        })
        .select()
        .single();

      if (!error && data) {
        const mapped = this.mapRow(data);
        ActionRepository.sharedInMemoryActions.set(id, mapped);
        return mapped;
      } else if (error) {
        console.error('Supabase pending_actions insert error:', error.message);
      }
    }

    const newAction: PendingAction = {
      ...action,
      id,
      createdAt: now,
      updatedAt: now,
    };
    ActionRepository.sharedInMemoryActions.set(id, newAction);
    return newAction;
  }

  async getById(id: string): Promise<PendingAction | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('pending_actions')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return this.mapRow(data);
      }
    }
    return ActionRepository.sharedInMemoryActions.get(id) || null;
  }

  async updateStatus(id: string, status: ActionState, metadata?: Record<string, any>): Promise<PendingAction> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Action '${id}' not found in database.`);
    }

    const mergedMetadata = metadata ? { ...existing.metadata, ...metadata } : existing.metadata;

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('pending_actions')
        .update({
          status,
          metadata: mergedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const mapped = this.mapRow(data);
        ActionRepository.sharedInMemoryActions.set(id, mapped);
        return mapped;
      }
    }

    const updatedAction: PendingAction = {
      ...existing,
      status,
      metadata: mergedMetadata,
      updatedAt: new Date().toISOString(),
    };
    ActionRepository.sharedInMemoryActions.set(id, updatedAction);
    return updatedAction;
  }

  private mapRow(row: any): PendingAction {
    return {
      id: row.id,
      userId: row.customer_id,
      actionType: row.action_type,
      status: row.status as ActionState,
      metadata: {
        ...row.metadata,
        authUserId: row.user_id,
        customerId: row.customer_id,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
