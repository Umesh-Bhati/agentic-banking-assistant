import type { ServerUIEvent } from '@boit/shared-types';

export const READ_ONLY_TOOLS: string[] = [
    'getAccounts',
    'getBalance',
    'getTransactions',
    'getUserCards',
    'getUserProducts',
    'searchProductKnowledge',
];

export type SensitiveActionPolicy =
    | { kind: 'none'; activeTools: typeof READ_ONLY_TOOLS }
    | { kind: 'card-block'; requiredEvent: 'CARD_SELECTION'; activeTools: ['initiateCardBlock']; guidance: string; fallback: string }
    | { kind: 'statement-quote'; requiredEvent: 'STATEMENT_QUOTE'; activeTools: ['getUserProducts', 'generateStatement']; guidance: string; fallback: string }
    | { kind: 'unsupported-money-movement'; guidance: string };

export const STATEMENT_REQUIREMENTS_PROMPT = 'Which displayed account should I use, and what start and end dates do you want? Reply with the account position (for example, "first account") and dates in YYYY-MM-DD format.';

const CARD_ACTION = /\b(?:block|freeze|lock)\b.{0,48}\bcard\b|\bcard\b.{0,48}\b(?:block|freeze|lock)\b/i;
const STATEMENT_ACTION = /\b(?:issue|generate|create|download|order|request|get)\b.{0,48}\bstatement\b|\bstatement\b.{0,48}\b(?:issue|generate|create|download|order|request)\b/i;
const STATEMENT_FEE_ACTION = /\b(?:charge|pay|debit|deduct)\b.{0,32}\b(?:statement\s+)?fee\b/i;
const MONEY_MOVEMENT = /\b(?:transfer|send|remit|wire|withdraw|pay)\b.{0,48}\b(?:money|funds?|cash|payment|beneficiary|recipient|account)\b|\b(?:money|funds?|cash|payment)\b.{0,48}\b(?:transfer|send|remit|wire|withdraw|pay)\b/i;
const REQUEST_SIGNAL = /(?:^|[.!?]\s*)(?:please\s+)?(?:block|freeze|lock|issue|generate|create|download|order|request|get|charge|pay|debit|deduct|transfer|send|remit|wire|withdraw)\b|\b(?:can|could|would|will)\s+you\b|\b(?:i\s+(?:want|need|would\s+like)|help\s+me|how\s+(?:do|can|could)\s+i)\b/i;
const NEGATED = /\b(?:do\s+not|don't|dont|not|never)\b.{0,24}\b(?:block|freeze|lock|issue|generate|create|transfer|send|pay|withdraw)\b/i;
const CANCELLED_FOLLOW_UP = /\b(?:cancel|never\s*mind|stop|forget\s+it)\b/i;
const STATEMENT_REQUIREMENTS_REPLY = /\b\d{4}-\d{2}-\d{2}\b|\b(?:first|second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s+(?:displayed\s+)?(?:account|product)\b|\b(?:savings|current|checking)\s+account\b|\baccount\s+(?:ending|number)\b/i;

function statementQuotePolicy(): Extract<SensitiveActionPolicy, { kind: 'statement-quote' }> {
    return {
        kind: 'statement-quote', requiredEvent: 'STATEMENT_QUOTE', activeTools: ['getUserProducts', 'generateStatement'],
        guidance: 'Review the secure statement quote and confirm it in the secure controls. No statement is issued and no fee is charged until the action result confirms completion.',
        fallback: 'I could not prepare the secure statement controls. Please try again. No statement was issued and no fee was charged.',
    };
}

export function sensitiveActionPolicy(message: string, pendingStatementRequirements = false): SensitiveActionPolicy {
    const text = message.normalize('NFKC');
    if (!REQUEST_SIGNAL.test(text) || NEGATED.test(text)) {
        if (pendingStatementRequirements && !CANCELLED_FOLLOW_UP.test(text) && STATEMENT_REQUIREMENTS_REPLY.test(text))
            return statementQuotePolicy();
        return { kind: 'none', activeTools: READ_ONLY_TOOLS };
    }
    const card = CARD_ACTION.test(text);
    const statement = STATEMENT_ACTION.test(text) || STATEMENT_FEE_ACTION.test(text);
    const money = MONEY_MOVEMENT.test(text);
    if (money || Number(card) + Number(statement) > 1) return {
        kind: 'unsupported-money-movement',
        guidance: 'This request cannot be completed in chat. Use the bank’s secure transfer, payment, or service controls.',
    };
    if (card) return {
        kind: 'card-block', requiredEvent: 'CARD_SELECTION', activeTools: ['initiateCardBlock'],
        guidance: 'Use the secure card-selection and authorization controls shown here. Your card remains unchanged until the action result confirms completion.',
        fallback: 'I could not prepare the secure card controls. Please try again. Your card was not changed.',
    };
    if (statement) return statementQuotePolicy();
    return { kind: 'none', activeTools: READ_ONLY_TOOLS };
}

export function hasPendingStatementRequirements(messages: Array<{ role: 'user' | 'assistant'; content: string }>): boolean {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message?.content.trim())
            return message.role === 'assistant' && message.content === STATEMENT_REQUIREMENTS_PROMPT;
    }
    return false;
}

export function eventAllowedByPolicy(policy: SensitiveActionPolicy, event: ServerUIEvent): boolean {
    if (event.type === 'PRIVATE_DATA') return true;
    if (policy.kind === 'none') return false;
    if (policy.kind === 'unsupported-money-movement') return false;
    return event.type === policy.requiredEvent;
}

export function responseForPolicy(policy: SensitiveActionPolicy, modelText: string, events: ServerUIEvent[]): string {
    if (policy.kind === 'none') return modelText;
    if (policy.kind === 'unsupported-money-movement') return policy.guidance;
    if (!events.some(event => event.type === policy.requiredEvent))
        return policy.kind === 'statement-quote' ? STATEMENT_REQUIREMENTS_PROMPT : policy.fallback;
    return policy.guidance;
}
