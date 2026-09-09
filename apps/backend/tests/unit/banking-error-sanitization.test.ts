import { describe, expect, it } from 'vitest';
import { AccountService } from '../../src/services/banking/account.service.js';
import { CardService } from '../../src/services/banking/card.service.js';
import { query } from '../helpers/database.js';

const sensitive = 'SQLSTATE 42P01: relation private_customer_data does not exist';

describe('model-invoked banking service errors', () => {
    it('does not expose database errors from account reads', async () => {
        const service = new AccountService({ from: () => query({ data: null, error: { message: sensitive } }) } as any);
        await expect(service.getAccounts('customer')).rejects.toThrow('Unable to read accounts');
        await expect(service.getAccounts('customer')).rejects.not.toThrow(sensitive);
    });

    it('does not expose database errors from card reads', async () => {
        const service = new CardService({ from: () => query({ data: null, error: { message: sensitive } }) } as any);
        await expect(service.getUserCards('customer')).rejects.toThrow('Unable to read cards');
        await expect(service.getUserCards('customer')).rejects.not.toThrow(sensitive);
    });
});

