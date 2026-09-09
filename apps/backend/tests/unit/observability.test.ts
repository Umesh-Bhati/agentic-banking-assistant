import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpanType } from '@mastra/core/observability';
import { createAgentObservability, toOperationalSpan } from '../../src/mastra/observability.js';

afterEach(() => vi.unstubAllEnvs());

describe('agent observability privacy boundary', () => {
    it('is disabled by default and rejects ambiguous configuration', () => {
        vi.stubEnv('AI_OBSERVABILITY_ENABLED', '');
        expect(createAgentObservability()).toBeUndefined();
        vi.stubEnv('AI_OBSERVABILITY_ENABLED', 'yes');
        expect(() => createAgentObservability()).toThrow('must be true or false');
    });

    it('can be explicitly enabled without a hosted exporter', () => {
        vi.stubEnv('AI_OBSERVABILITY_ENABLED', 'true');
        expect(createAgentObservability()).toBeDefined();
    });

    it('projects spans onto an operational allowlist before console export', () => {
        const raw = {
            id: 'span-id', traceId: 'trace-id', name: 'generate', type: SpanType.MODEL_GENERATION,
            startTime: new Date(), endTime: new Date(), isEvent: false, isRootSpan: true,
            input: 'my password is secret-value', output: 'private balance 5000',
            metadata: { account: '1234' }, requestContext: { requestId: 'req-123', privateContext: { credential: 'secret' } },
            errorInfo: { message: 'SQLSTATE secret', stack: 'private stack', category: 'provider' },
            attributes: { model: 'openrouter/anthropic/model', provider: 'openrouter', finishReason: 'stop', usage: { inputTokens: 12, outputTokens: 4, inputDetails: { text: 12 } }, parameters: { headers: { authorization: 'Bearer secret' } }, prompt: 'private prompt' },
        } as any;
        const safe = toOperationalSpan(raw) as any;
        expect(JSON.stringify(safe)).not.toMatch(/password|secret-value|balance|5000|SQLSTATE|Bearer|private prompt|private stack|account/);
        expect(safe).toMatchObject({ requestContext: { requestId: 'req-123' }, attributes: { model: 'openrouter/anthropic/model', usage: { inputTokens: 12, outputTokens: 4 } } });
        expect(safe.input).toBeUndefined();
        expect(safe.output).toBeUndefined();
    });
});
