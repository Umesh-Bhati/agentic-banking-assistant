import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createProductKnowledgeAgent } from '../agents/product-knowledge-agent.js';

interface ChatRequest {
  message: string;
  sessionId: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

type CoreUserMessage = { role: 'user'; content: string };
type CoreAssistantMessage = { role: 'assistant'; content: string };
type CoreMessage = CoreUserMessage | CoreAssistantMessage;

export function createChatRoute(
  fastify: FastifyInstance,
  config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    openaiApiKey: string;
    openrouterApiKey: string;
  }
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  const agent = createProductKnowledgeAgent({
    supabase,
    openaiApiKey: config.openaiApiKey,
    openrouterApiKey: config.openrouterApiKey,
  });

  fastify.post<{
    Body: ChatRequest;
  }>('/api/chat', async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
    const { message, sessionId, history = [] } = request.body;

    if (!message || !sessionId) {
      return reply.code(400).send({ error: 'Missing message or sessionId' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${data}\n\n`);
    };

    const sendError = (error: string) => {
      sendEvent(JSON.stringify({ type: 'error', error }));
    };

    const sendToken = (token: string) => {
      sendEvent(JSON.stringify({ type: 'token', content: token }));
    };

    const sendDone = () => {
      sendEvent(JSON.stringify({ type: 'done' }));
    };

    try {
      // Build messages array with history
      const messages: CoreMessage[] = [
        ...history.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      // Stream the agent response
      const stream = await agent.stream(messages, {
        maxSteps: 5,
      });

      for await (const chunk of stream.textStream) {
        if (chunk) {
          sendToken(chunk);
        }
      }

      sendDone();
    } catch (error) {
      console.error('Chat error:', error);
      sendError(error instanceof Error ? error.message : 'Internal server error');
      sendDone();
    } finally {
      reply.raw.end();
    }
  });
}