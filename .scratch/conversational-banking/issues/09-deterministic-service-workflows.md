# 09 — Deterministic Service Workflows

**What to build:** Fix card block defect (enforce auth gate) and add multi-product selection step to statement workflow.

**Blocked by:** 08 — Sign-Up Flow & Profile Preferences

**Status:** done

## Acceptance criteria

- [x] Card block: Select card → Confirm → Authorize (user's configured method) → Block
- [x] Card block never completes without explicit authorization
- [x] New /actions/:actionId/select-and-confirm endpoint returns auth preference
- [x] Statement: Select product (accounts/cards/loans) → Date range → Fee acceptance → Generate
- [x] getUserProductsTool returns all user's financial products
- [x] generateStatementTool requires explicit accountId (no hardcoded fallback)
- [x] Banking agent instructions enforce product selection before statement generation
