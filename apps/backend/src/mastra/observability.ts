import { SpanType, type AnyExportedSpan } from '@mastra/core/observability';
import { ConsoleExporter, Observability, SensitiveDataFilter } from '@mastra/observability';

const INCLUDED_SPANS = new Set<SpanType>([
    SpanType.AGENT_RUN,
    SpanType.MODEL_GENERATION,
    SpanType.MODEL_INFERENCE,
    SpanType.TOOL_CALL,
]);

function safeIdentifier(value: unknown): string | undefined {
    return typeof value === 'string' && /^[a-zA-Z0-9_.:/-]{1,160}$/.test(value) ? value : undefined;
}

function safeCount(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeUsage(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;
    const usage = value as Record<string, unknown>;
    const inputTokens = safeCount(usage.inputTokens);
    const outputTokens = safeCount(usage.outputTokens);
    return inputTokens === undefined && outputTokens === undefined ? undefined : { inputTokens, outputTokens };
}

/** Final allowlist projection applied immediately before a span reaches stdout. */
export function toOperationalSpan(span: AnyExportedSpan): AnyExportedSpan {
    const attributes = (span.attributes || {}) as Record<string, unknown>;
    const operationalAttributes = {
        model: safeIdentifier(attributes.model),
        provider: safeIdentifier(attributes.provider),
        responseModel: safeIdentifier(attributes.responseModel),
        finishReason: safeIdentifier(attributes.finishReason),
        usage: safeUsage(attributes.usage),
        maxSteps: safeCount(attributes.maxSteps),
        success: typeof attributes.success === 'boolean' ? attributes.success : undefined,
        tripwire: attributes.tripwireAbort ? 'blocked' : undefined,
    };
    const requestId = safeIdentifier(span.requestContext?.requestId);

    return {
        ...span,
        name: safeIdentifier(span.name) || span.type,
        entityId: safeIdentifier(span.entityId),
        entityName: safeIdentifier(span.entityName),
        attributes: Object.fromEntries(Object.entries(operationalAttributes).filter(([, value]) => value !== undefined)) as AnyExportedSpan['attributes'],
        metadata: undefined,
        input: undefined,
        output: undefined,
        requestContext: requestId ? { requestId } : undefined,
        errorInfo: span.errorInfo ? { name: 'AgentOperationError', category: safeIdentifier(span.errorInfo.category) } : undefined,
        tags: undefined,
    } as AnyExportedSpan;
}

export function createAgentObservability(): Observability | undefined {
    const setting = process.env.AI_OBSERVABILITY_ENABLED;
    if (setting === undefined || setting === '' || setting === 'false') return undefined;
    if (setting !== 'true') throw new Error('AI_OBSERVABILITY_ENABLED must be true or false');

    return new Observability({
        configs: {
            default: {
                serviceName: 'boit-banking-agent',
                exporters: [new ConsoleExporter({ logLevel: 'info', customSpanFormatter: toOperationalSpan })],
                spanOutputProcessors: [new SensitiveDataFilter({ redactionStyle: 'full' })],
                includeInternalSpans: false,
                spanFilter: span => INCLUDED_SPANS.has(span.type),
                requestContextKeys: ['requestId'],
                serializationOptions: { maxStringLength: 160, maxDepth: 2, maxArrayLength: 8, maxObjectKeys: 12 },
                cardinality: { blockUUIDs: true },
                logging: { enabled: false },
            },
        },
        sensitiveDataFilter: false,
    });
}
