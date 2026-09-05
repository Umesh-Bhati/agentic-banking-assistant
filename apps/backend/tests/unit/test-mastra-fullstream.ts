import { Agent } from '@mastra/core/agent';
const agent = new Agent({
  id: 'test',
  name: 'test',
  instructions: 'test',
  model: 'openrouter/openai/gpt-4o-mini',
});
async function main() {
  // Stub gateway manager to not throw API key error immediately? 
  // No, let's just see how fullStream looks in Vercel AI SDK docs since it's the same
}
