// Offline example: intent text is never an executable banking authorization.
// Run with pnpm --filter @boit/backend exec tsx test-intent.ts.
import { minimizeText } from './src/lib/privacy.js';
import { isServerUIEvent } from '@boit/shared-types';
const input = 'Show my statement from 2026-08-01 to 2026-08-31';
console.log({ minimized: minimizeText(input), textCanAuthorize: isServerUIEvent(input) });
