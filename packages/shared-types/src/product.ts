export type ProductType =
  | 'CURRENT_ACCOUNT'
  | 'SAVINGS_ACCOUNT'
  | 'CREDIT_CARD'
  | 'PERSONAL_LOAN'
  | 'HOME_LOAN'
  | 'AUTO_LOAN';

export interface CustomerProduct {
  id: string;
  customer_id: string;
  product_type: ProductType;
  product_name: string;
  product_number: string;
  linked_account_id?: string;
  linked_card_id?: string;
  balance: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}
