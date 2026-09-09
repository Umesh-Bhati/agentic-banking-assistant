import type { Processor, ProcessInputStepArgs, ProcessOutputResultArgs, ProcessOutputStreamArgs, ProcessToolResultArgs } from '@mastra/core/processors';
import type { ChunkType } from '@mastra/core/stream';

const DIRECT_HIJACK = [
    /\b(?:ignore|disregard|override|forget)\b.{0,80}\b(?:previous|prior|above|system|developer)\b.{0,40}\b(?:instructions?|rules?|prompt)\b/is,
    /\b(?:reveal|print|show|repeat|extract|dump)\b.{0,80}\b(?:system|developer|hidden|initial)\b.{0,30}\b(?:prompt|instructions?|message)\b/is,
    /<\/?(?:system|developer|assistant)>|\[(?:system|developer)\]/i,
];
const INTERNAL_ERROR = /\b(?:SQLSTATE|PostgREST|postgres(?:ql)?|relation ["'].+["']|supabase|service[_ -]?role)\b/i;
const SECRET = /\b(?:sk-[a-z0-9_-]{16,}|eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}|(?:api[_ -]?key|password|secret)\s*[:=]\s*\S{8,})/i;
const BANKING_SUBJECT = String.raw`(?:card|payment|transfer|statement|transaction|account|debit|credit|withdrawal)`;
const AUTHORITATIVE_STATE = String.raw`(?:blocked|froze|frozen|locked|unblocked|unlocked|completed|complete|successful|succeeded|processed|approved|declined|issued|generated|ready|sent|transferred|debited|credited|closed|opened|cancelled|canceled|reversed|paid|done|went\s+through)`;
const BANKING_OUTCOME_ASSERTION = new RegExp(String.raw`\b(?:${BANKING_SUBJECT})\b.{0,48}\b(?:is|was|has\s+been|is\s+now|was\s+successfully)?\s*(?:${AUTHORITATIVE_STATE})\b|\b(?:${AUTHORITATIVE_STATE})\b.{0,32}\b(?:${BANKING_SUBJECT})\b`, 'i');
const URL = /(?:https?:\/\/|javascript:|data:text\/html|file:\/\/)[^\s<>)\]}]+/gi;

function messageText(message: { content?: unknown }): string {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) return message.content.map(part => part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text : '').join('\n');
    if (!message.content || typeof message.content !== 'object') return '';
    const parts = (message.content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) return '';
    return parts.map(part => part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text : '').join('\n');
}

export function isHighConfidenceInstructionHijack(text: string): boolean {
    return DIRECT_HIJACK.some(pattern => pattern.test(text.normalize('NFKC')));
}

export function sanitizeToolResult(value: unknown, depth = 0): unknown {
    if (depth > 6) return '[tool result truncated]';
    if (typeof value === 'string') {
        const bounded = value.slice(0, 4000);
        if (isHighConfidenceInstructionHijack(bounded)) return '[untrusted instructions removed]';
        if (INTERNAL_ERROR.test(bounded) || SECRET.test(bounded)) return '[sensitive tool detail removed]';
        return bounded;
    }
    if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitizeToolResult(item, depth + 1));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 50).map(([key, item]) => [
        key,
        /^(?:error|stack|cause|details?|hint|query)$/i.test(key) ? '[tool detail removed]' : sanitizeToolResult(item, depth + 1),
    ]));
}

function approvedCitationUrls(requestContext: ProcessOutputStreamArgs['requestContext']): Set<string> {
    const privateContext = requestContext?.get('privateContext') as { approvedCitationUrls?: Set<string> } | undefined;
    return privateContext?.approvedCitationUrls ?? new Set();
}

export function validateCompleteModelText(text: string, allowedUrls: Set<string>): void {
    if (BANKING_OUTCOME_ASSERTION.test(text.normalize('NFKC'))) throw new Error('Unverified banking-state claim was blocked.');
    for (const match of text.matchAll(URL)) {
        const url = match[0].replace(/[.,;:!?]+$/, '');
        if (!url.startsWith('https://') || !allowedUrls.has(url)) throw new Error('Unapproved generated URL was blocked.');
    }
}

export class BankingInputBoundaryProcessor implements Processor<'banking-input-boundary', { category: string }> {
    readonly id = 'banking-input-boundary' as const;
    readonly name = 'Banking input boundary';

    processInputStep({ messages, stepNumber, abort }: ProcessInputStepArgs<{ category: string }>) {
        if (stepNumber !== 0) return;
        const unsafeUserMessage = messages.some(message => message.role === 'user' && isHighConfidenceInstructionHijack(messageText(message)));
        if (unsafeUserMessage) {
            abort('Request blocked by the banking safety boundary.', { retry: false, metadata: { category: 'instruction-hijack' } });
        }
    }
}

export class BankingOutputBoundaryProcessor implements Processor<'banking-output-boundary', { category: string }> {
    readonly id = 'banking-output-boundary' as const;
    readonly name = 'Banking output boundary';

    processToolResult({ result, abort }: ProcessToolResultArgs<{ category: string }>) {
        if (JSON.stringify(result) !== JSON.stringify(sanitizeToolResult(result))) {
            abort('Unsafe tool output was blocked.', { retry: false, metadata: { category: 'unsafe-tool-result' } });
        }
    }

    async processOutputStream({ part }: ProcessOutputStreamArgs<{ category: string }>): Promise<ChunkType | null | undefined> { return part; }

    processOutputResult({ result, messages, abort, requestContext }: ProcessOutputResultArgs<{ category: string }>) {
        try {
            validateCompleteModelText(result.text, approvedCitationUrls(requestContext));
        } catch (error) {
            abort(error instanceof Error ? error.message : 'Unsafe model output was blocked.', { retry: false, metadata: { category: 'unsafe-model-output' } });
        }
        return messages;
    }
}
