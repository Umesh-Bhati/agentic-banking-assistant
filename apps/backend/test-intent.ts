import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createIntentRouterAgent } from './src/agents/intent-router-agent.js';
import { CoreMessage } from '@mastra/core';

config();

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const agent = createIntentRouterAgent({
    supabase,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    openrouterApiKey: process.env.OPENROUTER_API_KEY!
  });

  const messages = [{ role: 'user', content: 'Give me all my cards which is blocked' }];
  const result = await agent.generate(messages as CoreMessage[], { maxSteps: 1 });
  console.log("Raw output:", result.text);
  try {
    const parsed = JSON.parse(result.text || '{}');
    console.log("Parsed JSON:", parsed);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
  }
}

run();
