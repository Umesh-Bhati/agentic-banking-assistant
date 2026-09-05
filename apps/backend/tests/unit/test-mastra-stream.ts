import { Agent } from '@mastra/core/agent';
const agent = new Agent({
  id: 'test',
  name: 'test',
  instructions: 'test',
  model: 'openrouter/openai/gpt-4o-mini',
});
async function main() {
  const stream = await agent.stream([{ role: 'user', content: 'hello' }]);
  console.log("textStream exists:", !!stream.textStream);
  console.log("fullStream exists:", !!stream.fullStream);
  console.log("stream is:", Object.getOwnPropertyNames(Object.getPrototypeOf(stream)));
}
main();
