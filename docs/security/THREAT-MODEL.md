# Security boundaries and threat model

Assets: authenticated sessions, factor enrollment secrets, customer identity, transaction history, account balances, card state, statement consent, and audit truth.

Attackers include unauthenticated callers, authenticated customers targeting other customers, prompt-injection authors, poisoned public documents, compromised model providers, and stolen operational credentials.

| Boundary | Required control | Evidence |
| --- | --- | --- |
| Client → API | Verified token, session identity/revocation, input bounds | Backend auth and route tests |
| Customer → database | RLS reads, revoked writes, composite ownership keys | Real role tests in `supabase/tests/security.sql` |
| Model → banking | Typed proposals, deterministic selection/consent, no generated URLs or authentication authority | Adversarial application tests |
| MFA → execution | Server verified factor challenge, action version/session binding, five-minute expiry, single consumption | SQL replay and version tests plus provider verification tests |
| Execution → ledger | Row locks, idempotency, atomic fee/card mutation and audit | SQL transactional tests |
| Public content → retrieval | Dedicated staging principal, administrator publication, bounded approved search | Migration privileges and staged publication review |
| Privileged operator → data | Least privilege deployment, secret rotation, independent audit export | External operational release gate |

The database service role is trusted to call `authorize_action` only after Supabase validates the OTP. Compromise of that role defeats this guarantee; it is not distributed to mobile or ingestion. The model never receives this credential. SQL owners remain trusted administrators. Simulator balances are not a production ledger and no financial reconciliation integration is provided.
