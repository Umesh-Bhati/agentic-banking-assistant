import { RequestContext } from '@mastra/core/request-context';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { mastra } from '../mastra/index.js';
import { SessionService } from '../services/chat/session.service.js';

interface ChatRequest {
  message: string;
  sessionId: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function createChatRoute(
  fastify: FastifyInstance,
  config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    openaiApiKey: string;
    openrouterApiKey: string;
  }
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  const sessionService = new SessionService(supabase);
  const bankingAgent = mastra.getAgent('bankingAgent');

  // GET /api/chat/sessions - Fetch all chat sessions for authenticated user
  fastify.get('/api/chat/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userId;
    const sessions = await sessionService.getUserSessions(userId);
    return reply.send(sessions);
  });

  // GET /api/chat/sessions/:id/messages - Fetch all messages for a session
  fastify.get('/api/chat/sessions/:id/messages', async (
    request: FastifyRequest<{ Params: { id: string } }>, 
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const messages = await sessionService.getSessionMessages(id);
    return reply.send(messages);
  });

  // DELETE /api/chat/sessions/:id - Delete a chat session
  fastify.delete('/api/chat/sessions/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>, 
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const userId = request.userId;
    const success = await sessionService.deleteSession(id, userId);
    return reply.send({ success });
  });

  // POST /api/chat - SSE stream chat agent response
  fastify.post<{
    Body: ChatRequest;
  }>('/api/chat', async (request, reply) => {
    const { message, sessionId, history = [] } = request.body || {};

    if (!message || !sessionId) {
      return reply.code(400).send({ error: 'Missing message or sessionId' });
    }

    const authUserId = request.userId;
    const customerId = request.customerId;

    // Immediately send 200 OK SSE headers so client gets TTFB < 500ms
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${data}\n\n`);
    };

    // Asynchronously save session and user message in background without blocking stream startup
    const userMessagePromise = (async () => {
      try {
        await sessionService.ensureSessionExists(sessionId, authUserId, message);
        await sessionService.saveMessage(sessionId, 'user', message);
      } catch (err) {
        console.error('Failed async user message save:', err);
      }
    })();

    let fullAssistantResponse = '';

    try {
      let previousMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (history.length > 0) {
        previousMessages = history.map(msg => ({
          role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: msg.content,
        }));
      } else {
        const savedMessages = await sessionService.getSessionMessages(sessionId);
        previousMessages = savedMessages
          .filter(m => m.content && m.content.trim() !== '' && m.content !== message)
          .map(m => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.content,
          }));
      }

      const messages: any = [
        ...previousMessages,
        { role: 'user' as const, content: message }
      ];

      // Attach trusted authenticated user context for tools
      const requestContext = new RequestContext();
      requestContext.set('userId', customerId);
      requestContext.set('sessionId', sessionId);

      const stream = await bankingAgent.stream(messages, { requestContext });

      for await (const chunk of stream.textStream) {
        if (chunk) {
          fullAssistantResponse += chunk;
          sendEvent(JSON.stringify({ type: 'text', content: chunk }));
        }
      }

      // Immediately send done event and close HTTP stream to unblock client UI
      sendEvent(JSON.stringify({ type: 'done' }));
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }

      // Asynchronously save user and assistant messages in background without blocking response completion
      (async () => {
        try {
          await userMessagePromise;
          if (fullAssistantResponse) {
            await sessionService.saveMessage(sessionId, 'assistant', fullAssistantResponse);
          }
        } catch (err) {
          console.error('Async background message persistence error:', err);
        }
      })();
    } catch (error) {
      console.error('Chat error:', error);
      if (!reply.raw.writableEnded) {
        sendEvent(JSON.stringify({ type: 'error', content: 'An error occurred processing your request.' }));
        reply.raw.end();
      }
    }
  });
}
