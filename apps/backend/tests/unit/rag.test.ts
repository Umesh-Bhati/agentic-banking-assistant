import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRagTool } from '@/tools/rag-tool.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock the AI SDK's embedMany function
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    embedMany: vi.fn(),
  };
});

import { embedMany } from 'ai';

describe('RAG Retrieval (Hybrid Search) - Logic Seam Tests', () => {
  let mockSupabase: Partial<SupabaseClient>;
  let ragTool: ReturnType<typeof createRagTool>;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
    } as unknown as SupabaseClient;

    ragTool = createRagTool({
      supabase: mockSupabase as SupabaseClient,
      openaiApiKey: 'test-openai-key',
    });

    vi.clearAllMocks();
  });

  it('should call hybrid_search RPC with correct parameters', async () => {
    const mockResults = [
      {
        content: 'Al Masraf Platinum Credit Card offers 5% cashback on dining',
        metadata: { source_url: 'https://almasraf.ae/cards/platinum', product_type: 'credit_card' },
        similarity: 0.92,
      },
      {
        content: 'Gold Card provides airport lounge access',
        metadata: { source_url: 'https://almasraf.ae/cards/gold', product_type: 'credit_card' },
        similarity: 0.87,
      },
    ];

    (mockSupabase.rpc as vi.Mock).mockResolvedValue({
      data: mockResults,
      error: null,
    });

    // Mock embedMany to return a fake embedding
    (embedMany as vi.Mock).mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
    });

    const result = await ragTool.execute({ query: 'What credit cards do you offer?' });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('hybrid_search', {
      query_text: 'What credit cards do you offer?',
      query_embedding: expect.any(Array),
      match_count: 5,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 50,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0].content).toContain('Platinum Credit Card');
    expect(result.results[0].similarity).toBe(0.92);
    expect(result.results[0].metadata.source_url).toContain('almasraf.ae');
  });

  it('should return empty results when no matches found', async () => {
    (mockSupabase.rpc as vi.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    (embedMany as vi.Mock).mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
    });

    const result = await ragTool.execute({ query: 'Completely unrelated query about sports' });

    expect(result.results).toHaveLength(0);
  });

  it('should handle RPC errors gracefully', async () => {
    (mockSupabase.rpc as vi.Mock).mockResolvedValue({
      data: null,
      error: { message: 'RPC function not found' },
    });

    (embedMany as vi.Mock).mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
    });

    await expect(ragTool.execute({ query: 'Test query' }))
      .rejects.toThrow('Hybrid search failed: RPC function not found');
  });

  it('should generate embedding for query before calling RPC', async () => {
    (mockSupabase.rpc as vi.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    (embedMany as vi.Mock).mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
    });

    await ragTool.execute({ query: 'Test query for embedding' });

    // Verify embedMany was called
    expect(embedMany).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.any(Object),
      values: ['Test query for embedding'],
    }));

    // Verify RPC was called with an embedding array
    const callArgs = (mockSupabase.rpc as vi.Mock).mock.calls[0];
    const queryEmbedding = callArgs[1].query_embedding;
    
    expect(queryEmbedding).toBeInstanceOf(Array);
    expect(queryEmbedding.length).toBeGreaterThan(0);
    expect(typeof queryEmbedding[0]).toBe('number');
  });
});