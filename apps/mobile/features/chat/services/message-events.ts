import { parseUiEvent, type BankingUi } from './ui-events';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  bankingTurnId?: string;
}
export type MessageBankingUi = BankingUi & { bankingTurnId: string };

// The server persists controls separately from text. Rejoin consecutive assistant
// records within the same turn, accepting only validated server UI envelopes.
export function restoreBankingMessages(records: Array<Message & { ui_data?: unknown }>) {
  const messages: Message[] = [];
  const events: MessageBankingUi[] = [];
  for (const record of records) {
    if (record.role === 'user') {
      messages.push({ id: record.id, role: 'user', content: record.content });
      continue;
    }
    const event = parseUiEvent(record.ui_data);
    if (!record.content && !event) continue;
    let message = messages[messages.length - 1];
    if (!message || message.role !== 'assistant') {
      message = { id: record.id, role: 'assistant', content: '', bankingTurnId: record.id };
      messages.push(message);
    }
    if (record.content) message.content = [message.content, record.content].filter(Boolean).join('\n\n');
    if (event) events.push({ ...event, bankingTurnId: message.bankingTurnId! });
  }
  return { messages, events };
}
