-- Enable pgvector extension (already in 001, but safe to include)
create extension if not exists vector with schema public;

-- Create the hybrid_search function with Reciprocal Rank Fusion (RRF)
-- This function combines full-text search (tsvector) with semantic search (pgvector)
create or replace function hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int default 10,
  full_text_weight float = 1.0,
  semantic_weight float = 1.0,
  rrf_k int = 50
)
returns setof bank_documents
language sql
as $$
with full_text as (
  select
    id,
    row_number() over (order by ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery(query_text)) desc) as rank_ix
  from
    bank_documents
  where
    to_tsvector('english', content) @@ websearch_to_tsquery(query_text)
  order by rank_ix
  limit least(match_count, 30) * 2
),
semantic as (
  select
    id,
    row_number() over (order by embedding <#> query_embedding) as rank_ix
  from
    bank_documents
  where
    embedding is not null
  order by rank_ix
  limit least(match_count, 30) * 2
)
select
  bank_documents.*
from
  full_text
  full outer join semantic
    on full_text.id = semantic.id
  join bank_documents
    on coalesce(full_text.id, semantic.id) = bank_documents.id
order by
  coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
  coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
  desc
limit
  least(match_count, 30)
$$;