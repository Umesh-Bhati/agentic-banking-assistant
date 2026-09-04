# 01 — Monorepo & Database Foundation

**What to build:** A foundational, running environment where the backend and frontend are co-locating types. Furthermore, the core banking database schema exists with verifiable seed data for a demo user (John Doe) to ensure subsequent services have realistic scenarios to work with.

**Blocked by:** None — can start immediately.

**Status:** done

## Acceptance criteria

- [ ] A TypeScript monorepo is established (e.g. using npm, yarn, or pnpm workspaces) containing a placeholder React Native (Expo) app and a Fastify server.
- [ ] Supabase schema is created supporting `users`, `chat_sessions` (JSONB for state), `bank_documents` (pgvector), `customer_profiles`, `bank_accounts`, `cards`, and `transactions`.
- [ ] A `seed.sql` script runs on Supabase initialization giving "John Doe" exactly 1 Current Account, 1 Savings Account, 3 Mastercards, and 30 mock transactions.
- [ ] Basic types interface (e.g., `interface Card`) can be imported safely by both Fastify backend and Expo frontend.