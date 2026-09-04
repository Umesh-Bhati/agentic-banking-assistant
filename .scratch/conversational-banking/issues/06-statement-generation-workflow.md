# 06 — Statement Generation & Fee Deduction Workflow

**What to build:** Proving the orchestration framework's extensibility. We introduce a net-new workflow that follows the exact same pause/resume architecture, but now interacts with different financial data, calculates fees, mutates balances dynamically, and renders a rich native UI component rather than plain text.

**Blocked by:** 05 — Human-in-the-Loop Authorization UI

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A new `StatementRequestWorkflow` in Mastra correctly extracts "From" and "To" dates.
- [ ] The workflow performs a human-in-the-loop suspension: it pauses to ask "Generating this statement will cost 25 AED. Do you accept?"
- [ ] Upon user acceptance, the workflow executes by inserting a `-25.00` fee entry to the user's `transactions` table.
- [ ] The final response sent over SSE is a structured JSON payload rather than loose text: e.g. `{ type: 'STATEMENT_CARD', data: { url: '...', fee: 25 } }`.
- [ ] The React Native chat interface parses the JSON structure and elegantly renders a rich custom UI component in the chat history rather than a text bubble.