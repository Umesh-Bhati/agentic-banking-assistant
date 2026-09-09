# Local security verification

These results describe the synthetic simulator in the working tree, not a deployed banking service.

## Current non-database verification — 2026-09-09

Root `pnpm test` passed 150 non-database tests: 118 backend, 29 mobile, and 3 dependency regression checks; the separately gated live-provider smoke test was skipped. `pnpm eval:agent` independently passed 46 executable security checks across five files. These include 13 policy-unit corpus cases, five real Mastra `Agent` trajectories driven by AI SDK's `MockLanguageModelV4` (input tripwire, safe text, trusted tool/UI, invalid-alias tool error, and bounded looping), plus route, processor, alias/schema, provider/privacy, statement-clarification continuation, interruption, no-partial-release, and runtime tool-limit coverage. The policy-unit fixtures are not counted as trajectories. The default `pnpm eval:agent:live` invocation was also verified to refuse execution without its explicit safety environment. `pnpm typecheck` passed across the workspace, and `git diff --check` passed. The repository currently contains 14 numbered migrations. The PostgreSQL suite was **not rerun** on 2026-09-09, so the database results below remain historical evidence from 2026-09-08 and do not verify migration 014 or the current database-test harness.

## Historical verification — 2026-09-08

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed across the workspace |
| `pnpm test` | Passed: 89 total — 65 backend, 21 mobile, 3 dependency checks |
| Frozen lockfile installation | Passed |
| `pnpm audit --audit-level=moderate` | Passed, no known vulnerabilities reported, including development dependencies |
| Fresh PostgreSQL 17 database with pgvector | All 13 migrations applied successfully |
| SQL negative/security tests | Passed ownership isolation, direct-write denial, expired/stale/replayed MFA challenges, unregistered factor denial, registry owner foreign key, statement fee consent/rollback/idempotency, direct-read logout revocation, malformed/missing session denial |
| Concurrent SQL statement confirmations | Passed: two independent connections produced one fee transaction, one issuance audit record, and a final balance of 75 from 100 |
| iOS production export | Passed with environment loading disabled and synthetic HTTPS API URL: 4,044 modules, Hermes bundle, 46 assets |
| Native iOS development build | Built and installed on the local simulator |
| Native authentication smoke test | Passed actual login, approved authenticator status, background lock, password sign-in again, and logout; synthetic customer only |
| Actual local Supabase Auth | Password login and bank-approved TOTP enrollment/verification passed for two synthetic customers; direct signup rejected while existing email/password login remained available |
| Actual banking HTTP flows | Statement consent, TOTP authorization, retry and authenticated PDF download passed; one 25 AED debit confirmed in the database. Card selection, TOTP authorization and database `BLOCKED` status passed |
| `git diff --check` | Passed |

Initial SQL verification used fresh disposable local databases, never application environment credentials or a hosted project. That isolated PostgreSQL instance was stopped after testing. The subsequent `boit-security-demo` Docker project applied all 13 migrations and exercised real local Supabase Auth with synthetic fixtures. Existing projects were preserved. Migration 012 also fixes authenticated statement-read grants; migration 013 prevents factors enrolled directly through Supabase Auth from authorizing banking without bank registration. See [local setup and live evidence](LOCAL-DEMO.md).

CI and `pnpm audit:dependencies` include build/test dependencies in the vulnerability audit. Audit results are point-in-time and do not prove the absence of vulnerabilities. The demo follow-up preserved the lockfile and restored dependencies with a frozen install; its audit was not repeated.

Successful AI orchestration remains unverified because no valid approved provider key was available. Card proposal testing invoked the actual banking service directly before exercising the HTTP authorization flow; it does not prove an AI tool call. The native recording demonstrates authentication and app locking, not card/statement execution. Backend and mobile regressions verify unavailable, empty and interrupted AI responses remain errors without leaking provider diagnostics or claiming success.

Hosted Supabase Auth/MFA behavior, production exposed schemas and grants, provider settings, backup restoration, monitoring delivery, physical-device biometrics/MFA and PDF sharing, and real banking integrations remain external gates. Local simulator interaction and HTTP tests do not establish those properties. See [operations and external release gates](OPERATIONS.md).
