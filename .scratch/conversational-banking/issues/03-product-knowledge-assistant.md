# 03 — Product Knowledge Assistant (Module 1)

**What to build:** A chat interface on the mobile app that allows users to ask questions about Al Masraf banking products. It retrieves answers instantly using hybrid search and streams the text back exactly like standard ChatGPT interfaces—but constrained only to banking topics.

**Blocked by:** 02 — The Firecrawl Ingestion Pipeline

**Status:** done

## Acceptance criteria

- [ ] The React Native (Expo) application has a chat screen capable of sending HTTP POST requests and rendering incoming streamed responses (SSE).
- [ ] The Fastify backend has a `/api/chat` endpoint utilizing a Top-Level Mastra Agent powered by OpenRouter (e.g., claude-3.5-sonnet or gpt-4o).
- [ ] A Supabase PostgreSQL RPC function implements Reciprocal Rank Fusion (RRF), executing both Cosine Similarity against `pgvector` and Full-Text Search against `tsvector`.
- [ ] RAG logic: When a user asks a question, the Agent transforms it to an embedding, executes the hybrid search RPC, injects the matched context, and streams the answer back.
- [ ] Guardrails rule triggers: If the user asks about an unrelated topic (e.g. "Who won the game?"), the agent politely refuses.