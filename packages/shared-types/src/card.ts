export type CardStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX';
export interface Card {
    id: string;
    customer_id: string;
    last_4: string;
    status: CardStatus;
    network: CardNetwork;
    card_type: string;
    expiry_month: number;
    expiry_year: number;
    created_at: string;
    updated_at: string;
}
