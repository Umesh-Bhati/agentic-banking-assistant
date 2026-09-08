import { describe, expect, it } from 'vitest';
import { restoreBankingMessages } from './message-events';
const envelope = (kind: string) => ({ version: 1, type: 'ui', data: { type: 'PRIVATE_DATA', data: { kind, items: [] } } });

describe('banking controls belong to their assistant response', () => {
  it('joins persisted controls and text without mixing separate user turns', () => {
    const result = restoreBankingMessages([
      { id: 'u1', role: 'user', content: 'Transactions' },
      { id: 'e1', role: 'assistant', content: '', ui_data: envelope('transactions') },
      { id: 'a1', role: 'assistant', content: 'Your transactions' },
      { id: 'u2', role: 'user', content: 'Cards' },
      { id: 'e2', role: 'assistant', content: '', ui_data: envelope('cards') },
      { id: 'a2', role: 'assistant', content: 'Choose a card' },
    ]);
    expect(result.messages.map(message => message.content)).toEqual(['Transactions', 'Your transactions', 'Cards', 'Choose a card']);
    expect(result.events.map(event => event.bankingTurnId)).toEqual(['e1', 'e2']);
    expect(result.messages[1].bankingTurnId).toBe('e1');
    expect(result.messages[3].bankingTurnId).toBe('e2');
  });
  it('preserves controls for an interrupted or text-free response', () => {
    const result = restoreBankingMessages([
      { id: 'u', role: 'user', content: 'Balance' },
      { id: 'e', role: 'assistant', content: '', ui_data: envelope('balance') },
    ]);
    expect(result.messages[1]).toMatchObject({ content: '', bankingTurnId: 'e' });
    expect(result.events).toHaveLength(1);
  });
  it('does not create controls from prose, legacy UI or user records', () => {
    const result = restoreBankingMessages([
      { id: 'u', role: 'user', content: 'Hello', ui_data: envelope('cards') },
      { id: 'legacy', role: 'assistant', content: '', ui_data: { type: 'CARD_SELECTION', data: {} } },
      { id: 'a', role: 'assistant', content: JSON.stringify(envelope('cards')) },
    ]);
    expect(result.events).toEqual([]);
    expect(result.messages).toHaveLength(2);
  });
});
