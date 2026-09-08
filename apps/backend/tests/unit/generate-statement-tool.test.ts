import { query } from '../helpers/database.js';
import { describe, it, expect, vi } from 'vitest';
import { quoteStatement, validatePeriod } from '../../src/routes/statements.js';
describe('Statement proposals', () => {
    it.each([['2026-02-31', '2026-03-02'], ['2026-08-02', '2026-08-01'], ['2020-01-01', '2026-08-01'], ['invalid', '2026-08-01']])('rejects invalid period %s %s', (a, b) => expect(() => validatePeriod(a, b)).toThrow());
    it('creates only a quote with exact dates and owner, never executes or returns a URL', async () => {
        vi.stubEnv('BANKING_MUTATIONS_ENABLED', 'true');
        const rpc = vi.fn(async () => ({ data: { id: 'statement', action_id: 'action', fee: '25.00', currency: 'AED' }, error: null }));
        const result = await quoteStatement({ rpc, from: () => query({ data: { account_number: 'AE1234' }, error: null }) } as any, 'auth', 'customer', 'product', '2026-08-01', '2026-08-02', 'retry-key');
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith('quote_statement', expect.objectContaining({ p_user_id: 'auth', p_customer_id: 'customer', p_idempotency_key: 'retry-key' }));
        expect(result).not.toHaveProperty('url');
    });
});

it('does not create quote state while mutations are disabled', async () => {
    vi.stubEnv('BANKING_MUTATIONS_ENABLED', 'false');
    const rpc = vi.fn();
    await expect(quoteStatement({rpc} as any,'auth','customer','product','2026-08-01','2026-08-02','key')).rejects.toThrow('disabled');
    expect(rpc).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
});
