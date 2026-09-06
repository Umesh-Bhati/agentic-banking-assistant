import { SupabaseClient } from '@supabase/supabase-js';
import type { Card } from '@boit/shared-types';

export class CardService {
  constructor(private supabase: SupabaseClient) {}

  async getUserCards(customerId: string): Promise<Card[]> {
    const { data: cards, error } = await this.supabase
      .from('cards')
      .select('id, customer_id, last_4, status, network, card_type, expiry_month, expiry_year, created_at, updated_at')
      .eq('customer_id', customerId)
      .eq('status', 'ACTIVE');

    if (error) {
      throw new Error(`Failed to fetch cards: ${error.message}`);
    }

    return (cards || []) as Card[];
  }

  async blockCard(cardId: string, customerId: string): Promise<{ success: boolean; message: string }> {
    // Validate ownership
    const { data: card, error: fetchError } = await this.supabase
      .from('cards')
      .select('customer_id, last_4, card_type')
      .eq('id', cardId)
      .single();
      
    if (fetchError || !card) {
      throw new Error('Card not found');
    }
    
    if (card.customer_id !== customerId) {
      throw new Error('Unauthorized');
    }

    const { error: updateError } = await this.supabase
      .from('cards')
      .update({ status: 'BLOCKED', updated_at: new Date().toISOString() })
      .eq('id', cardId);

    if (updateError) {
      throw new Error(`Failed to block card: ${updateError.message}`);
    }

    return {
      success: true,
      message: `Your ${card.card_type} ending in ${card.last_4} has been successfully blocked.`,
    };
  }
}
