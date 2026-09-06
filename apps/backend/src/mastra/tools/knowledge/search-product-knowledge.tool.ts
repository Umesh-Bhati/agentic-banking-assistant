import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSharedSupabaseClient } from '../../../lib/shared-supabase.js';

export const searchProductKnowledgeTool = createTool({
  id: 'search-product-knowledge',
  description: 'Search Al Masraf banking products (accounts, cards, loans) using hybrid search combining semantic and full-text search.',
  inputSchema: z.object({
    query: z.string().describe('The user question about banking products'),
  }),
  execute: async ({ query }) => {
    const supabase = getSharedSupabaseClient();
    const openaiApiKey = process.env.OPENAI_API_KEY!;
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

    let results: any[] | null = null;

    try {
      // 2.5-second timeout for query embedding to prevent OpenRouter hangs
      const embeddingPromise = embedMany({
        model: provider.embedding(modelName),
        values: [query],
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding API timeout')), 2500)
      );

      const { embeddings } = await Promise.race([embeddingPromise, timeoutPromise]);
      const queryEmbedding = embeddings[0];

      const { data, error } = await supabase.rpc('hybrid_search', {
        query_text: query,
        query_embedding: queryEmbedding,
        match_count: 5,
        full_text_weight: 1.0,
        semantic_weight: 1.0,
        rrf_k: 50,
      });

      if (!error && data && data.length > 0) {
        results = data;
      }
    } catch (e) {
      console.warn('Embedding or hybrid search fallback triggered:', (e as Error).message);
    }

    // Fallback: Precision keyword search on bank_documents
    if (!results || results.length === 0) {
      const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
      const orConditions = searchTerms.length > 0
        ? searchTerms.map(t => `content.ilike.%${t}%`).join(',')
        : 'content.ilike.%banking%';

      const { data: fallbackDocs } = await supabase
        .from('bank_documents')
        .select('id, content, metadata')
        .or(orConditions)
        .limit(5);

      results = fallbackDocs || [];
    }

    return {
      results: (results || []).map((doc: any) => ({
        content: doc.content,
        metadata: doc.metadata || {},
        similarity: doc.similarity ?? 0.8,
      })),
    };
  },
});
