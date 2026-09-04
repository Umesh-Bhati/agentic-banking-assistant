# 05 — Human-in-the-Loop Authorization UI

**What to build:** The critical security and execution leg of the workflow. The app will visually prompt the user to provide mocked PIN/Biometric authorization. Once provided, the system formally executes the service on the database layer to prove real banking actions work securely.

**Blocked by:** 04 — Intent Routing & Card Block Workflow

**Status:** ready-for-agent

## Acceptance criteria

- [ ] The `CardBlockWorkflow` pauses and sets its state in Supabase to `WAITING_FOR_AUTH` after the user selects a card to block.
- [ ] The Fastify backend streams a special "Auth Required" signal block via SSE.
- [ ] The Expo mobile app detects this signal and renders a visual mock "Enter PIN / Face ID" modal overlaying the chat.
- [ ] Once the user confirms the modal, the app POSTs the authorization token back to Fastify.
- [ ] Fastify resumes the Mastra workflow. The service executes by updating the targeted card's status to `BLOCKED` in the `cards` table.
- [ ] The bot replies confirming the success of the block operation.