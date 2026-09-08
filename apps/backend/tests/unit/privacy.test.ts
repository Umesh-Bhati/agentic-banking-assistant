import { describe, it, expect } from 'vitest';
import { minimizeText } from '../../src/lib/privacy.js';
import { isServerUIEvent } from '@boit/shared-types';
describe('Privacy guard and UI schemas', () => {
    it('preserves statement dates while redacting email phones and secrets', () => {
        const text = minimizeText('from 2026-08-01 to 2026-08-31 email name@example.com phone +971500123456');
        expect(text).toContain('2026-08-01');
        expect(text).toContain('2026-08-31');
        expect(text).not.toContain('name@example.com');
        expect(text).not.toContain('971500');
        expect(minimizeText('my pin is 1234')).not.toContain('1234');
    });
    it('does not accept arbitrary statement URL cards as server events', () => {
        expect(isServerUIEvent({ type: 'STATEMENT_CARD', data: { url: 'https://evil' } })).toBe(false);
        expect(isServerUIEvent({ type: 'CARD_SELECTION', data: { actionId: 'a', actionType: 'BLOCK_CARD', cards: [{ id: 'c', type: 'DEBIT', last4: 'not-numeric' }] } })).toBe(false);
    });
});
