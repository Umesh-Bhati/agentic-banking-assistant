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

export type BankingChatEvent =
  | TextEvent
  | CardSelectionEvent
  | StatementReadyEvent
  | AuthorizationRequiredEvent
  | ActionResultEvent;

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
