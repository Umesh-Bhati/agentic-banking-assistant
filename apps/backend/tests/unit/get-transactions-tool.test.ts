import { describe, it, expect, vi } from 'vitest';
import { AccountService } from '../../src/services/banking/account.service.js';
import { privateResult, toolContext, resolveAlias } from '../../src/mastra/tools/context.js';
import { query, principal } from '../helpers/database.js';
describe('Financial tool boundaries', () => {
    it('does not query transactions before ownership succeeds', async () => {
        const from = vi.fn(() => query({ data: null, error: null }));
        await expect(new AccountService({ from } as any).getTransactions('owner', 'foreign')).rejects.toThrow('Account not found');
        expect(from).toHaveBeenCalledTimes(1);
        expect(from).toHaveBeenCalledWith('bank_accounts');
    });
    it('sends private details to UI and only aliases to the model', async () => {
        const emit = vi.fn();
        const context = { principal, database: {} as any, aliases: new Map<string, string>(), emit };
        const result = await privateResult(context, 'accounts', [{ id: 'private-id', account_number: 'AE12345678', balance: '5000.00' }]);
        expect(JSON.stringify(result)).not.toMatch(/AE123|5000|private-id/);
        expect(emit).toHaveBeenCalled();
        expect(resolveAlias(context, 'accounts-1')).toBe('private-id');
        expect(() => resolveAlias(context, 'foreign')).toThrow();
        expect(() => toolContext(undefined)).toThrow();
    });
});
