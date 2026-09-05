import { Agent } from '@mastra/core/agent';
const agent = new Agent({
  id: 'test',
  name: 'test',
  instructions: 'test',
  model: 'openrouter/openai/gpt-4o-mini',
});
async function main() {
  const stream = await agent.stream([{ role: 'user', content: 'hello' }]);
  // @ts-ignore
  for await (const chunk of stream.fullStream) {}
}
