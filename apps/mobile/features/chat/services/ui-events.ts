import { isServerUIEvent, type ServerUIEvent } from '@boit/shared-types';
export type BankingUi = ServerUIEvent;
export function parseUiEvent(raw: unknown): BankingUi | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as { version?: unknown; type?: unknown; data?: unknown };
  return envelope.version === 1 && envelope.type === 'ui' && isServerUIEvent(envelope.data) ? envelope.data : null;
}
