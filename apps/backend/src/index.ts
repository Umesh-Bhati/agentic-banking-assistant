import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from 'dotenv';
import { createChatRoute } from './routes/chat.js';
import { createActionRoutes } from './routes/action.routes.js';
import { createStatementRoute } from './routes/statements.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createProfileRoutes } from './routes/profile.routes.js';
import authPlugin from './plugins/auth.plugin.js';

config();

// Clean inline comments and trim environment variables
for (const key of Object.keys(process.env)) {
  if (process.env[key]) {
    process.env[key] = process.env[key]!.split('#')[0].trim();
  }
}

export async function createServer(): Promise<FastifyInstance> {
  const server = fastify({
    logger: true,
  });

  server.get('/health', async () => {
    return { status: 'ok' };
  });

  const requiredEnv = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'OPENAI_API_KEY',
  ];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      server.log.warn(`Missing environment variable: ${key}`);
    }
  }

  if (requiredEnv.every(key => process.env[key])) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

    await server.register(authPlugin, {
      supabaseUrl,
      supabaseServiceKey,
    });

    await createAuthRoutes(server, {
      supabaseUrl,
      supabaseServiceKey,
    });

    await createProfileRoutes(server, { supabaseUrl, supabaseServiceKey });

    await createActionRoutes(server, {
      supabaseUrl,
      supabaseServiceKey,
    });
    
    await createChatRoute(server, {
      supabaseUrl,
      supabaseServiceKey,
      openaiApiKey: process.env.OPENAI_API_KEY!,
      openrouterApiKey: process.env.OPENROUTER_API_KEY!,
    });

    await createStatementRoute(server, {
      supabaseUrl,
      supabaseServiceKey,
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
