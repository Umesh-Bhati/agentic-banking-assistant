import { Card } from './card.js';
export interface TextEvent {
    type: "TEXT";
    content: string;
}
export interface CardSelectionEvent {
    type: "CARD_SELECTION";
    data: {
        actionType: string;
        cards: Array<{
            id: string;
            type: string;
            last4: string;
        }>;
    };
}
export interface StatementReadyEvent {
    type: "STATEMENT_READY";
    data: {
        statementId: string;
        month: string;
        url?: string;
    };
}
export interface AuthorizationRequiredEvent {
    type: "AUTHORIZATION_REQUIRED";
    data: {
        actionId: string;
        actionType: string;
    };
}
export interface ActionResultEvent {
    type: "ACTION_RESULT";
    data: {
        actionId: string;
        status: "COMPLETED" | "FAILED";
        message: string;
    };
}
export type BankingChatEvent = TextEvent | CardSelectionEvent | StatementReadyEvent | AuthorizationRequiredEvent | ActionResultEvent;
export interface StatementCardData {
    statementId: string;
    month: string;
    accountNumber?: string;
    fromDate?: string;
    toDate?: string;
    fee?: number;
    currency?: string;
    url?: string;
}
export interface StatementQuoteData {
    debitAccountLabel: string;
    statementId: string;
    actionId: string;
    productId: string;
    accountId: string;
    fromDate: string;
    toDate: string;
    fee: string;
    currency: string;
    status: string;
}
export type ServerUIEvent = {
    type: 'CARD_SELECTION';
    data: {
        actionId: string;
        actionType: string;
        cards: Array<{
            id: string;
            type: string;
            last4: string;
        }>;
    };
} | {
    type: 'STATEMENT_QUOTE';
    data: StatementQuoteData;
} | {
    type: 'PRIVATE_DATA';
    data: {
        kind: string;
        items: Record<string, unknown>[];
    };
};
export type ServerChatEvent = {
    version: 1;
    type: 'text' | 'error';
    content: string;
} | {
    version: 1;
    type: 'done';
} | {
    version: 1;
    type: 'ui';
    data: ServerUIEvent;
};
export function isServerUIEvent(value: unknown): value is ServerUIEvent {
    if (!value || typeof value !== 'object')
        return false;
    const event = value as {
        type?: unknown;
        data?: any;
    };
    const d = event.data;
    if (!d || typeof d !== 'object')
        return false;
    if (event.type === 'CARD_SELECTION')
        return typeof d.actionId === 'string' && typeof d.actionType === 'string' && Array.isArray(d.cards) && d.cards.length <= 100 && d.cards.every((c: any) => c && typeof c.id === 'string' && typeof c.type === 'string' && /^\d{4}$/.test(c.last4));
    if (event.type === 'STATEMENT_QUOTE')
        return ['statementId', 'actionId', 'productId', 'accountId', 'debitAccountLabel', 'fromDate', 'toDate', 'fee', 'currency', 'status'].every(k => typeof d[k] === 'string') && /^\d+(\.\d{1,2})?$/.test(d.fee);
    return event.type === 'PRIVATE_DATA' && ['accounts', 'balance', 'transactions', 'cards', 'products'].includes(d.kind) && Array.isArray(d.items) && d.items.length <= 1000 && d.items.every((i: unknown) => i !== null && typeof i === 'object' && !Array.isArray(i));
}
