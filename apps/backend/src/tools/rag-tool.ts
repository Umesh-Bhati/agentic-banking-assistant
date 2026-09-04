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
      // Generate embedding for the query
      const openai = createOpenAI({ apiKey: config.openaiApiKey });
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
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