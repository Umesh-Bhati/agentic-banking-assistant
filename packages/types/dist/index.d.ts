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
export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export interface CustomerProfile {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    kyc_status: KYCStatus;
    created_at: string;
    updated_at: string;
}
export type WorkflowState = 'IDLE' | 'WAITING_CARD_SELECTION' | 'WAITING_FOR_AUTH' | 'WAITING_FEE_ACCEPTANCE' | 'WAITING_DATE_RANGE' | 'COMPLETED';
export interface ActiveWorkflowState {
    workflow_type: string;
    step: WorkflowState;
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
export interface ChatSession {
    id: string;
    user_id: string;
    active_workflow_state: ActiveWorkflowState | null;
    created_at: string;
    updated_at: string;
}
export interface BankDocument {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    embedding: number[] | null;
    created_at: string;
}
//# sourceMappingURL=index.d.ts.map