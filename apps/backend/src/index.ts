import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from 'dotenv';
import { createChatRoute } from './routes/chat.js';

config();

export async function createServer(): Promise<FastifyInstance> {
  const server = fastify({
    logger: true,
  });

  server.get('/health', async () => {
    return { status: 'ok' };
  });

  // Register chat route
  const requiredEnv = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
  ];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      server.log.warn(`Missing environment variable: ${key}`);
    }
  }

  if (requiredEnv.every(key => process.env[key])) {
    createChatRoute(server, {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
      openaiApiKey: process.env.OPENAI_API_KEY!,
      openrouterApiKey: process.env.OPENROUTER_API_KEY!,
    });
  }

  return server;
}

export async function startServer(): Promise<void> {
  const server = await createServer();
  
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer();