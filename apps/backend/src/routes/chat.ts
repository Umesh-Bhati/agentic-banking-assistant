import { isServerUIEvent, type ServerUIEvent } from '@boit/shared-types';
import { RequestContext } from '@mastra/core/request-context';
import { FastifyInstance } from 'fastify';
import { createBankingAgent } from '../mastra/agents/banking-agent.js';
import { SessionService } from '../services/chat/session.service.js';
import { getSharedSupabaseClient } from '../lib/shared-supabase.js';
import { minimizeText } from '../lib/privacy.js';
import { aiConfiguration } from '../lib/ai-config.js';
import { AGENT_TIMEOUT_MS, MAX_AGENT_STEPS, MAX_OUTPUT_TOKENS, MAX_RESPONSE_CHARACTERS, MAX_UI_EVENTS } from '../mastra/agent-policy.js';
import { validateCompleteModelText } from '../mastra/processors/banking-boundary.processor.js';
import { eventAllowedByPolicy, hasPendingStatementRequirements, responseForPolicy, sensitiveActionPolicy } from '../mastra/sensitive-action-policy.js';
import type { SensitiveActionPolicy } from '../mastra/sensitive-action-policy.js';

const FAILED_STREAM_PARTS = new Set(['error', 'tool-error', 'abort', 'tripwire', 'agent-execution-abort', 'tool-execution-abort', 'routing-agent-abort', 'workflow-execution-abort']);

export function isFailedAgentStreamPart(chunk: { type?: string; payload?: unknown }): boolean {
    if (FAILED_STREAM_PARTS.has(chunk.type || '')) return true;
    if (chunk.type !== 'finish' || !chunk.payload || typeof chunk.payload !== 'object') return false;
    const reason = (chunk.payload as { stepResult?: { reason?: unknown } }).stepResult?.reason;
    return reason === 'tripwire' || reason === 'retry' || reason === 'error';
}

function agentStreamFailure(chunk: { type?: string; payload?: unknown }): Error {
    const payload = chunk.payload && typeof chunk.payload === 'object'
        ? chunk.payload as { error?: unknown }
        : undefined;
    return new Error(`AI provider stream failed (${chunk.type || 'unknown'})`, payload?.error === undefined ? undefined : { cause: payload.error });
}

export async function collectValidatedAgentText(
    fullStream: AsyncIterable<{ type?: string; payload?: any }>,
    approvedUrls: Set<string>,
    actionPolicy: SensitiveActionPolicy,
    ui: ServerUIEvent[],
) {
    let text = '';
    let toolCalls = 0;
    let finalReason: unknown;
    const trajectory: string[] = [];
    for await (const chunk of fullStream) {
        trajectory.push(chunk.type || 'unknown');
        if (isFailedAgentStreamPart(chunk)) throw agentStreamFailure(chunk);
        if (chunk.type === 'tool-call' && ++toolCalls > MAX_UI_EVENTS) throw new Error('Tool limit exceeded');
        if (chunk.type === 'finish') finalReason = chunk.payload?.stepResult?.reason ?? chunk.payload?.finishReason;
        if (chunk.type !== 'text-delta') continue;
        text += chunk.payload.text;
        if (text.length > MAX_RESPONSE_CHARACTERS) throw new Error('Response limit exceeded');
    }
    if (finalReason === 'tool-calls') throw new Error('Agent stopped before completing the response.');
    if (!text.trim() && ui.length === 0) throw new Error('Empty AI response');
    validateCompleteModelText(text, approvedUrls);
    return { text: responseForPolicy(actionPolicy, text, ui), trajectory };
}
export async function createChatRoute(fastify: FastifyInstance, _config: unknown) {
    const active = new Set<string>();
    const bankingAgent = createBankingAgent();
    fastify.get('/api/chat/sessions', request => new SessionService(request.database, getSharedSupabaseClient()).getUserSessions(request.userId));
    fastify.get<{
        Params: {
            id: string;
        };
    }>('/api/chat/sessions/:id/messages', request => new SessionService(request.database, getSharedSupabaseClient()).getSessionMessages(request.params.id, request.userId));
    fastify.delete<{
        Params: {
            id: string;
        };
    }>('/api/chat/sessions/:id', async (request) => ({ success: await new SessionService(request.database, getSharedSupabaseClient()).deleteSession(request.params.id, request.userId) }));
    fastify.post<{
        Body: {
            message: string;
            sessionId: string;
            history?: unknown;
        };
    }>('/api/chat', async (request, reply) => {
        const { message, sessionId, history } = request.body || {};
        if (typeof message !== 'string' || !message.trim() || message.length > 4000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId || '') || history !== undefined)
            return reply.code(400).send({ error: 'Invalid chat request; history is server-owned' });
        if (active.has(request.userId))
            return reply.code(429).send({ error: 'A response is already active' });
        if (process.env.AI_ENABLED !== 'true')
            return reply.code(503).send({ error: 'AI provider processing is disabled' });
        active.add(request.userId);
        const startedAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
        const disconnect = () => {
            if (!reply.raw.writableEnded)
                controller.abort();
        };
        reply.raw.on('close', disconnect);
        const sessions = new SessionService(request.database, getSharedSupabaseClient());
        let text = '';
        const ui: ServerUIEvent[] = [];
        try {
            const messageSafe = minimizeText(message);
            await sessions.ensureSessionExists(sessionId, request.userId, messageSafe);
            const previous = await sessions.getSessionMessages(sessionId, request.userId);
            const actionPolicy = sensitiveActionPolicy(messageSafe, hasPendingStatementRequirements(previous));
            await sessions.saveMessage(sessionId, 'user', messageSafe, undefined, request.userId);
            reply.hijack();
            reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
            const send = (event: unknown) => {
                if (controller.signal.aborted)
                    throw new Error('Request cancelled');
                reply.raw.write('data: ' + JSON.stringify(event) + '\n\n');
            };
            const emit = async (event: unknown) => {
                if (!isServerUIEvent(event))
                    throw new Error('Invalid server event');
                if (!eventAllowedByPolicy(actionPolicy, event))
                    throw new Error('Tool event exceeded the request capability');
                if (ui.length >= MAX_UI_EVENTS)
                    throw new Error('Tool limit exceeded');
                ui.push(event);
                await sessions.saveMessage(sessionId, 'assistant', '', { version: 1, type: 'ui', data: event }, request.userId);
                send({ version: 1, type: 'ui', data: event });
            };
            const requestContext = new RequestContext();
            requestContext.set('currentDate', new Date().toISOString().slice(0, 10));
            requestContext.set('requestId', request.id);
            const approvedCitationUrls = new Set<string>();
            requestContext.set('privateContext', { principal: request.principal, database: request.database, aliases: new Map<string, string>(), approvedCitationUrls, signal: controller.signal, emit });
            const messages = [...previous.filter(m => m.content).slice(-12).map(m => m.role === 'assistant' ? { role: 'assistant' as const, content: minimizeText(m.content).slice(0, 4000) } : { role: 'user' as const, content: minimizeText(m.content).slice(0, 4000) }), { role: 'user' as const, content: messageSafe }];
            if (actionPolicy.kind === 'unsupported-money-movement') {
                text = actionPolicy.guidance;
                await sessions.saveMessage(sessionId, 'assistant', text, undefined, request.userId);
                send({ version: 1, type: 'text', content: text });
                send({ version: 1, type: 'done' });
                return;
            }
            const configuration = aiConfiguration();
            const stream = await bankingAgent.stream(messages, {
                requestContext,
                maxSteps: MAX_AGENT_STEPS,
                toolCallConcurrency: 1,
                modelSettings: { maxOutputTokens: MAX_OUTPUT_TOKENS },
                providerOptions: configuration.providerOptions,
                abortSignal: controller.signal,
                activeTools: actionPolicy.activeTools,
            });
            text = (await collectValidatedAgentText(stream.fullStream, approvedCitationUrls, actionPolicy, ui)).text;
            await sessions.saveMessage(sessionId, 'assistant', minimizeText(text), undefined, request.userId);
            if (text) send({ version: 1, type: 'text', content: text });
            send({ version: 1, type: 'done' });
            request.log.info({ event: 'ai_response_completed', requestId: request.id, model: configuration.model, characters: text.length, toolEvents: ui.length, latencyMs: Date.now() - startedAt, outcome: 'completed' }, 'AI response completed');
        }
        catch (error) {
            const failure = { event: controller.signal.aborted ? 'ai_response_aborted' : 'ai_response_failed', requestId: request.id, latencyMs: Date.now() - startedAt, outcome: controller.signal.aborted ? 'aborted' : 'failed' };
            if (process.env.NODE_ENV === 'production')
                request.log.warn(failure, 'AI response interrupted');
            else
                request.log.error({ ...failure, err: error }, 'AI response interrupted');
            try {
                await sessions.saveMessage(sessionId, 'assistant', 'Response interrupted. Check action status before retrying.', { type: 'RESPONSE_INTERRUPTED' }, request.userId);
            }
            catch {
                request.log.warn('Unable to persist conversation interruption');
            }
            if (reply.raw.headersSent) {
                if (!reply.raw.destroyed)
                    reply.raw.write('data: ' + JSON.stringify({ version: 1, type: 'error', content: 'Response interrupted. Check action status before retrying.' }) + '\n\n');
            }
            else
                reply.code(400).send({ error: 'Unable to process conversation' });
        }
        finally {
            clearTimeout(timeout);
            reply.raw.off('close', disconnect);
            active.delete(request.userId);
            if (reply.raw.headersSent && !reply.raw.writableEnded)
                reply.raw.end();
        }
    });
}
