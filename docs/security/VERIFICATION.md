# Local security verification — 2026-09-08

These results describe the synthetic simulator in the working tree, not a deployed banking service.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed across the workspace |
| `pnpm test` | Passed: 62 backend, 15 mobile, 3 dependency checks |
| Frozen lockfile installation | Passed |
| `pnpm audit --audit-level=moderate` | Passed, no known vulnerabilities reported, including development dependencies |
| Fresh PostgreSQL 17 database with pgvector | All 13 migrations applied successfully |
| SQL negative/security tests | Passed ownership isolation, direct-write denial, expired/stale/replayed MFA challenges, unregistered factor denial, registry owner foreign key, statement fee consent/rollback/idempotency, direct-read logout revocation, malformed/missing session denial |
| Concurrent SQL statement confirmations | Passed: two independent connections produced one fee transaction, one issuance audit record, and a final balance of 75 from 100 |
| iOS production export | Passed with environment loading disabled and synthetic HTTPS API URL: 4,044 modules, Hermes bundle, 46 assets |
| `git diff --check` | Passed |

SQL verification used fresh disposable local databases, never application environment credentials or a hosted project. The isolated PostgreSQL instance was stopped after testing. Migration 012 also fixes authenticated statement-read grants; migration 013 prevents factors enrolled directly through Supabase Auth from authorizing banking without bank registration.

CI and `pnpm audit:dependencies` include build/test dependencies in the vulnerability audit. Audit results are point-in-time and do not prove the absence of vulnerabilities.

Hosted Supabase Auth/MFA behavior, configured exposed schemas and grants, provider settings, backup restoration, monitoring delivery, physical-device MFA and PDF sharing, and real banking integrations were not exercised. A production export is a build check, not a device interaction test. See [operations and external release gates](OPERATIONS.md).
