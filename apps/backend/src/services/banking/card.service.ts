import { SupabaseClient } from '@supabase/supabase-js';
import type { Card } from '@boit/shared-types';
export class CardService {
    constructor(private supabase: SupabaseClient) {
    }
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
}
