export type AccountType = 'CURRENT' | 'SAVINGS';
export type AccountStatus = 'ACTIVE' | 'DORMANT' | 'CLOSED';

export interface BankAccount {
  id: string;
  customer_id: string;
  account_number: string;
  balance: number;
  currency: string;
  type: AccountType;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'CREDIT' | 'DEBIT';
export type TransactionCategory = 'TRANSFER' | 'PAYMENT' | 'FEE' | 'WITHDRAWAL' | 'DEPOSIT';

export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  merchant_name?: string;
  created_at: string;
}
