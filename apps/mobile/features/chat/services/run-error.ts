import type { ChatModelRunResult } from '@assistant-ui/react-native';
import { ApiError } from '../../../lib/api/client';

/** Resolve failures as incomplete runtime results; never rethrow provider diagnostics. */
export async function chatRunError(error: unknown, state: {
  isCurrent: () => boolean;
  isCancelled: () => boolean;
  expireSession: () => Promise<void>;
}): Promise<ChatModelRunResult | undefined> {
  if (!state.isCurrent() || state.isCancelled()) return;
  if (error instanceof ApiError && error.status === 401) {
    // expireSession clears visible state before attempting secure-storage cleanup.
    try { await state.expireSession(); } catch { /* The signed-out screen remains authoritative. */ }
    return;
  }
  const message = error instanceof ApiError && error.status === 503
    ? 'AI chat is currently unavailable. Please try again later. Check bank status before retrying any banking operation.'
    : 'The chat response was interrupted. Reload your conversation and check bank status before retrying.';
  return {
    content: [],
    status: { type: 'incomplete', reason: 'error', error: message },
  };
}
