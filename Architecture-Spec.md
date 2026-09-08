# AI-Powered Conversational Banking Platform: Architecture & Specification

## Problem Statement

Al Masraf customers need a modern, extensible conversational interface to discover banking products (Accounts, Credit Cards, Loans) and execute self-service banking requests (e.g., blocking a card, requesting a statement). The problem is two-fold: providing accurate, hallucination-free knowledge about the bank's static products, and providing secure, deterministic, multi-turn stateful execution of banking services that require dynamic human-in-the-loop authorization (like a PIN or Biometric check). The institution requires this to be built as a generic, extensible foundation capable of supporting dozens of future services without rewriting the core orchestration engine.

## Solution

A full-stack, highly extensible conversational banking platform. 
1. **Frontend**: A React Native (Expo) mobile application providing a secure chat interface, capable of streaming real-time responses and rendering structured UI service components (e.g., Statement Cards).
2. **Backend**: A Fastify Node.js server written in TypeScript. 
3. **Orchestration**: Mastra AI powers a Top-Level Intent Router Agent. 
   - Questions about products are routed to a RAG pipeline (documents extracted via Firecrawl, stored in Supabase with `pgvector`, queried via Hybrid Search).
   - Service requests (like Card Block or Statement Generation) are routed to deterministic Mastra Workflows, allowing for safe human-in-the-loop pauses.
4. **Data Layer**: Supabase handles Authentication, LLM configuration, and a Core Banking relational schema (`cards`, `accounts`, `transactions`) representing the source of truth for the service execution.

## User Stories

1. As a mobile bank customer, I want to authenticate securely into the application, so that my financial data and chat history are protected.
2. As a mobile bank customer, I want to ask open-ended questions about Al Masraf's accounts, cards, and loans, so that I can make informed decisions about which products suit me.
3. As a mobile bank customer, I want to receive fast, streamed text responses back from the AI agent, so that the experience feels responsive and natural.
4. As a mobile bank customer, I want the bot to remember context from previous messages, so that I can ask follow-up questions without repeating myself.
5. As a mobile bank customer, I want to request that one of my cards be blocked through the chat, so that I can secure my account quickly if a card is lost.
6. As a mobile bank customer with multiple cards, I want the bot to ask me which specific card to block, so that I don't accidentally block the wrong one.
7. As a mobile bank customer, I want to securely authorize sensitive requests (like card blocking) via a PIN or Biometric prompt inside the app, so that unauthorized users cannot execute critical services.
8. As a mobile bank customer, I want to be able to change my mind, say "Cancel", or "Go back" in the middle of a service workflow, so that I am not trapped in an unwanted conversational loop.
9. As a mobile bank customer, I want to request an account statement for a specific date range, so that I can review my transaction history.
10. As a mobile bank customer, I want to be informed of any fees associated with generating a statement before it is executed, so that I can accept or decline the charge.
11. As a mobile bank customer, I want to see the generated statement presented as a clean, structured UI component within the chat, so that it is easy to read.
12. As a platform engineer, I want all service requests (Address Change, Cheque Book Request, etc.) to use the exact same extensible workflow pattern, so that new banking features can be added rapidly without touching core routing logic.

## Implementation Decisions

- **Repository Structure**: A TypeScript NPM Monorepo housing both the Expo frontend and the Fastify backend, allowing shared type definitions (e.g., UI component payload schemas, API contracts).
- **Frontend Framework**: React Native via Expo, styled with NativeWind for a premium UI mimicking Al Masraf brand guidelines (Turquoise/Blue and White).
- **Backend API Contract**: HTTP POST endpoint `/api/chat` for incoming messages. Responses stream back via Server-Sent Events (SSE).
- **LLM Provider**: OpenRouter API. `anthropic/claude-3.5-sonnet` (or `gpt-4o`) for Agent Orchestration/Routing. Native OpenAI `text-embedding-3-small` exclusively for RAG embeddings.
- **RAG Ingestion System**: Firecrawl will automatically extract clean Markdown from the `almasraf.ae` product pages. Mastra's `MDocument` handles chunking.
- **Search System**: Supabase Postgres RPC running a Reciprocal Rank Fusion (RRF) algorithm to combine `pgvector` Cosine Similarity and `tsvector` Full-Text Search for high-accuracy product retrieval.
- **Intent & State Routing**: Supabase's `chat_sessions` table will hold a JSONB `active_workflow_state`. Fastify intercepts incoming requests; if a workflow is in progress (e.g., waiting for PIN auth), it routes the user's message directly to that Mastra Workflow. Otherwise, it routes to the Top-Level Mastra Agent.
- **Core Banking Schema Requirements**:
  - `customer_profiles` (id, user_id, kyc_status)
  - `bank_accounts` (account_number, balance, type)
  - `cards` (last_4, status, network)
  - `transactions` (amount, category, description). Used for dynamically deducting statement generation fees and retrieving statement history.
- **Seeding**: A `seed.sql` file will bootstrap Mock Users with exact demo conditions (3 active Mastercards, 2 core accounts, 30 historical transactions).

## Testing Decisions

### What makes a good test here?
A good test for an AI orchestration system evaluates external boundaries and deterministic rules, NOT the exact phrasing of an LLM. We test meaning and state-transitions, not string equality.

### The Highest Seams (Test Boundaries)
Since this is a greenfield project, we have structured the architecture to expose two ideal testing seams:
1. **The Fastify Network Boundary**: E2E tests executing HTTP POST requests with conversational input and asserting on the final SSE payloads. This tests the Top-Level Router and RAG retrieval in concert.
2. **The Mastra Workflow Boundary (Logic Seam)**: Testing the deterministic Mastra Workflows (e.g., `CardBlockWorkflow`) completely isolated from the HTTP layer. We can initialize a workflow with specific states (e.g., `WAITING_FOR_AUTH`) and assert the state transitions to `COMPLETED` when valid auth mock signatures are provided.

### Modules to Test
- `IntentRouter`: Ensure "Cancel" wipes the `active_workflow_state` in the database.
- `RAG Retrieval (Hybrid Search)`: Mock the Supabase RPC and ensure the correct product document chunks are fed into the LLM context.
- `CardBlock / Statement Workflows`: Ensure that attempting to block a card without sufficient Auth fails, and ensure generating a statement deducts the exact fee amount from the `bank_accounts`/`transactions` mock tables.

## Out of Scope

- Real banking integration (Core Banking APIs, Visa/Mastercard processing). All financial data is mocked in Supabase.
- Advanced production CI/CD pipelines. This is built as an extensible local/prototype platform.
- Managing user registration flows and email confirmations (we assume pre-seeded Supabase magic links or dummy credentials for the demo).

## Further Notes

- By implementing Tools in Mastra (e.g., `fetch_user_cards()`), we strictly prevent the LLM from hallucinating account data, acting exactly like an enterprise middleware layer. The LLM simply translates intent to Tool Calls, and formatting to text. Tool logic executes securely on the backend against Postgres.

## Security authority (supersedes earlier workflow and authorization descriptions)

Mastra is a replaceable proposal-generation adapter. Banking state and authorization are owned by deterministic services and PostgreSQL transactions, not Mastra persistent workflows. Distinct authentication-user and customer IDs form the request principal. TOTP challenges are verified by Supabase and consumed once against the bound action version and session. Legacy PIN, biometric-token, and model-provided fee acceptance paths are retired.

Database migrations 009–013 revoke customer mutation privileges, establish durable action/challenge/revocation/audit and statement records, and restrict approved knowledge publication. Statement confirmation charges the simulator's 25 AED fee once and snapshots its transaction rows. Knowledge ingestion uses a separate staging-only principal. See [security operations](docs/security/OPERATIONS.md) and [threat model](docs/security/THREAT-MODEL.md) for trust boundaries, migration ordering, evidence, and production gates.
