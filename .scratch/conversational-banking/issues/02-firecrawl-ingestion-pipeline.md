# 02 — The Firecrawl Ingestion Pipeline

**What to build:** An automated script capable of pulling product banking intelligence from the real Al Masraf website, processing it cleanly, and making it available to our AI's semantic search layer.

**Blocked by:** 01 — Monorepo & Database Foundation

**Status:** done

## Acceptance criteria

- [ ] A Node.js ingestion script exists inside the monorepo.
- [ ] The script uses the Firecrawl API to extract high-quality, sanitized Markdown content from `almasraf.ae` (e.g. Accounts, Cards, Loans pages).
- [ ] The extracted markdown is piped into Mastra's `MDocument` capability to safely chunk the text.
- [ ] The chunks are converted to vectors via OpenAI `text-embedding-3-small` and inserted into the `bank_documents` table in Supabase.