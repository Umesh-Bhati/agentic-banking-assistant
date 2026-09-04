# 04 — Intent Routing & Card Block Workflow (Module 2)

**What to build:** The shift from answering questions to executing real services. The system can detect when a user wants to block a card, look up their actual cards, present the options, and preserve the conversational state in the database while waiting for their reply.

**Blocked by:** 03 — Product Knowledge Assistant

**Status:** done

## Acceptance criteria

- [x] Add a `chat_sessions` read/write check in Fastify to track `active_workflow_state`.
- [x] If the user asks "Block my card," the Top-Level Agent interprets the intent and routes the task to a deterministic Mastra Workflow named `CardBlockWorkflow`.
- [x] The workflow queries the Supabase `cards` table for the authenticated user and retrieves their cards.
- [x] The bot replies asking "Which of your 3 cards would you like to block?" and the step state (`WAITING_CARD_SELECTION`) is preserved in Postgres.
- [x] If the user says "Cancel" or "Go Back", an Intent Router intercepts the message, clears the database state, and responds appropriately.