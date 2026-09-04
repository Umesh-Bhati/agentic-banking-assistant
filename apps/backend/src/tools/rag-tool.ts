import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export interface RagToolConfig {
  supabase: SupabaseClient;
  openaiApiKey: string;
}

export function createRagTool(config: RagToolConfig) {
  return createTool({
    id: 'search-banking-products',
    description: 'Search Al Masraf banking products (accounts, cards, loans) using hybrid search combining semantic and full-text search.',
    inputSchema: z.object({
      query: z.string().describe('The user question about banking products'),
    }),
    execute: async ({ query }) => {
      const openaiApiKey = config.openaiApiKey;
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      let apiKey = openrouterApiKey || openaiApiKey;
      
      if (apiKey === 'your_openai_api_key' && openrouterApiKey) {
        apiKey = openrouterApiKey;
      }
      
      const isOpenRouter = apiKey === openrouterApiKey;

      const providerConfig = isOpenRouter
        ? { baseURL: 'https://openrouter.ai/api/v1', apiKey }
        : { apiKey };

      const provider = createOpenAI(providerConfig);
      const modelName = isOpenRouter ? 'openai/text-embedding-3-small' : 'text-embedding-3-small';

      // Generate embedding for the query
      const { embeddings } = await embedMany({
        model: provider.embedding(modelName),
        values: [query],
      });
      const queryEmbedding = embeddings[0];

      // Call hybrid_search RPC
      const { data: results, error } = await config.supabase.rpc('hybrid_search', {
        query_text: query,
        query_embedding: queryEmbedding,
        match_count: 5,
        full_text_weight: 1.0,
        semantic_weight: 1.0,
        rrf_k: 50,
      });

      if (error) {
        throw new Error(`Hybrid search failed: ${error.message}`);
      }

      return {
        results: (results || []).map((doc: any) => ({
          content: doc.content,
          metadata: doc.metadata || {},
          similarity: doc.similarity,
        })),
      };
    },
  });
}