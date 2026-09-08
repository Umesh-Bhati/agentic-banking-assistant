import { isServerUIEvent } from '@boit/shared-types';
import { RequestContext } from '@mastra/core/request-context';
import { FastifyInstance } from 'fastify';
import { createBankingAgent } from '../mastra/agents/banking-agent.js';
import { SessionService } from '../services/chat/session.service.js';
import { getSharedSupabaseClient } from '../lib/shared-supabase.js';
import { minimizeText } from '../lib/privacy.js';
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const disconnect = () => {
            if (!reply.raw.writableEnded)
                controller.abort();
        };
        reply.raw.on('close', disconnect);
        const sessions = new SessionService(request.database, getSharedSupabaseClient());
        let text = '';
        const ui: unknown[] = [];
        try {
            await sessions.ensureSessionExists(sessionId, request.userId);
            const previous = await sessions.getSessionMessages(sessionId, request.userId);
            const messageSafe = minimizeText(message);
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
                if (ui.length >= 8)
                    throw new Error('Tool limit exceeded');
                ui.push(event);
                await sessions.saveMessage(sessionId, 'assistant', '', { version: 1, type: 'ui', data: event }, request.userId);
                send({ version: 1, type: 'ui', data: event });
            };
            const requestContext = new RequestContext();
            requestContext.set('privateContext', { principal: request.principal, database: request.database, aliases: new Map<string, string>(), signal: controller.signal, emit });
            const messages = [...previous.filter(m => m.content).slice(-12).map(m => m.role === 'assistant' ? { role: 'assistant' as const, content: minimizeText(m.content).slice(0, 4000) } : { role: 'user' as const, content: minimizeText(m.content).slice(0, 4000) }), { role: 'user' as const, content: messageSafe }];
            const stream = await bankingAgent.stream(messages, { requestContext, maxSteps: 8, modelSettings: { maxOutputTokens: 2000 }, abortSignal: controller.signal });
            for await (const chunk of stream.textStream) {
                text += chunk;
                if (text.length > 16000)
                    throw new Error('Response limit exceeded');
                send({ version: 1, type: 'text', content: chunk });
            }
            await sessions.saveMessage(sessionId, 'assistant', minimizeText(text), undefined, request.userId);
            send({ version: 1, type: 'done' });
            request.log.info({ event: 'ai_response_completed', characters: text.length, toolEvents: ui.length }, 'AI response completed');
        }
        catch {
            request.log.warn({ event: controller.signal.aborted ? 'ai_response_aborted' : 'ai_response_failed' }, 'AI response interrupted');
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
