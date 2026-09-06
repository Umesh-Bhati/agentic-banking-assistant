import { Mastra } from '@mastra/core';
import { bankingAgent } from './agents/banking-agent.js';

export const mastra = new Mastra({
  agents: {
    bankingAgent,
  },
});
