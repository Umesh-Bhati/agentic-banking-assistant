import { SupabaseClient } from '@supabase/supabase-js';
import type { BankAccount, Transaction } from '@boit/shared-types';
export class AccountService {
    constructor(private supabase: SupabaseClient) {
    }
    async getAccounts(customerId: string): Promise<BankAccount[]> {
        const { data: accounts, error } = await this.supabase
            .from('bank_accounts')
            .select('*')
            .eq('customer_id', customerId);
        if (error) {
            throw new Error(`Failed to fetch accounts: ${error.message}`);
        }
        return (accounts || []).map(account => ({ ...account, balance: String(account.balance) })) as BankAccount[];
    }
    async getBalance(customerId: string, accountId?: string): Promise<{
        balance: string;
        currency: string;
    }> {
        let query = this.supabase
            .from('bank_accounts')
            .select('balance, currency')
            .eq('customer_id', customerId);
        if (accountId) {
            query = query.eq('id', accountId);
        }
        const { data: accounts, error } = await query;
        if (error) {
            throw new Error(`Failed to fetch balance: ${error.message}`);
        }
        if (!accounts || accounts.length === 0) {
            throw new Error('Account not found');
        }
        return {
            balance: String(accounts[0].balance),
            currency: accounts[0].currency
        };
    }
    async getTransactions(customerId: string, accountId?: string, limit: number = 7, fromDate?: string, toDate?: string): Promise<Transaction[]> {
        if (!accountId)
            throw new Error('Account ID is required for transaction lookup.');
        const { data: owned, error: ownershipError } = await this.supabase.from('bank_accounts').select('id').eq('id', accountId).eq('customer_id', customerId).single();
        if (ownershipError || !owned)
            throw new Error('Account not found');
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
            throw new Error('Invalid transaction limit');
        const targetAccountId = accountId;
        let query = this.supabase
            .from('transactions')
            .select('*')
            .eq('account_id', targetAccountId)
            .order('created_at', { ascending: false });
        if (fromDate) {
            query = query.gte('created_at', fromDate);
        }
        if (toDate) {
            query = query.lte('created_at', `${toDate}T23:59:59.999Z`);
        }
        if (limit) {
            query = query.limit(limit);
        }
        const { data: transactions, error } = await query;
        if (error) {
            throw new Error(`Failed to fetch transactions: ${error.message}`);
        }
        return (transactions || []).map(transaction => ({ ...transaction, amount: String(transaction.amount) })) as Transaction[];
    }
}
