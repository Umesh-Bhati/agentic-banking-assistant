import { json } from '../../../lib/api/client';
import { resourceId } from '../../../lib/api/policy';
import type { Session } from '../../auth/services/session';
export interface ActionResult { success?: boolean; action: { id: string; status: string; version: number }; token?: string; refreshToken?: string; expiresAt?: number; executionResult?: unknown; }
export const actions = {
  confirm: (token: string, id: string, cardId: string) => json<ActionResult>(`/actions/${resourceId(id)}/confirm`, token, { cardId }),
  status: (token: string, id: string) => json<ActionResult>(`/actions/${resourceId(id)}`, token),
  cancel: (token: string, id: string) => json<ActionResult>(`/actions/${resourceId(id)}/cancel`, token, {}),
  challenge: (token: string, id: string, factorId?: string) => json<{ challengeId: string; expiresAt: string; method?: string; payload?: string; publicKey?: string }>(`/actions/${resourceId(id)}/challenge`, token, { factorId }),
  authorize: (token: string, id: string, challengeId: string, credentials: { code?: string; pin?: string; signature?: string }) => json<ActionResult & Partial<Session>>(`/actions/${resourceId(id)}/authorize`, token, { challengeId, ...credentials }),
};
