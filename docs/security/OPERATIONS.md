# Banking simulator security operations

This repository implements a synthetic banking simulator. Never attach a real banking adapter or import customer data as a consequence of deploying these changes. Mastra generates proposals; server policy, verified identity, PostgreSQL transactions, and explicit user confirmation establish banking outcomes.

## Migration and release

1. Back up the database and prove restoration in an isolated environment. Do not place backup data or credentials in repository files, CI artifacts, tickets, or model prompts.
2. Run migrations against a restored staging copy. Audit mismatched pending-action auth/customer IDs and product/account/card ownership before migration 009; composite foreign keys deliberately reject inconsistent legacy data. Resolve through audited administrative review, not silent reassignment.
3. Pause banking mutations and deploy migrations 009–013 in sequence. They expire old pending actions, revoke insecure PIN functions, remove all customer writes, switch authentication preference to TOTP, and stage existing knowledge documents. Old mobile clients are incompatible and must be rejected by the coordinated API release.
4. Deploy backend and mobile together. Enroll TOTP factors through the bank API after fresh password verification; only server-registered factors in `banking_mfa_factors` can authorize banking, including after direct Supabase Auth enrollment; do not grant a password-only recovery shortcut. Verify health, real database tests, cross-customer isolation, MFA replay denial, statement confirmation/fee accounting, and restart recovery.
5. Review staged public source versions and publish only approved versions with effective dates using the administrator-only `publish_knowledge` function. Empty knowledge search before approval is intentional.
6. Keep dependency/secret scans blocking. Run an independent security assessment and approve provider residency, retention, key custody, recovery objectives, and bank integration contracts before any separate production-enablement project.

Rollback means disable mutations, restore application compatibility using a forward fix, and preserve audit/financial history. Do not roll back security grants to make an old client function. Restoring a database backup after financial writes requires reconciliation, never blind overwrite.

## Access and secrets

Backend service credentials remain highly privileged and must be confined to the server persistence boundary. Customer request clients use their verified bearer tokens for reads. Anonymous/authenticated Data API roles cannot mutate banking records or invoke authorization RPCs. Restrictive customer-read policies also enforce session revocation against the verified JWT session ID. Keep `security_private` outside the Supabase exposed API schemas. Missing or malformed session claims deny reads. Retain revoked session IDs until the Auth session can no longer refresh or issue any valid access token; access-token expiry alone is not sufficient for cleanup. Database owners can override all controls: restrict that operational role and audit its use externally.

Ingestion loads only its own environment. Provision a short-lived JWT for the `knowledge_ingestor` role through trusted administrative infrastructure; store it as `INGESTION_SUPABASE_KEY`. This role can insert staged public knowledge only. Never supply the backend service key. Set `APPROVED_EMBEDDING_PROVIDER=openai` only after provider approval. Ingestion never approves its own content. An administrator reviews source URL, hash, text, dates, and completeness before publication.

Rotate credentials by provisioning replacements in the secret manager, deploying consumers, verifying health, revoking old credentials, and reviewing access logs. Never log bearer tokens, OTPs, factor secrets, passwords, private financial content, or signed document payloads.

## Incident response

Disable AI traffic through backend configuration when provider behavior is suspect. Disable banking mutations independently during authorization or integrity incidents. Revoke affected sessions, preserve append-only audit events and infrastructure logs, rotate compromised secrets, and compare issued statement fees and card results with recorded action outcomes. Communicate only after incident ownership and disclosure obligations are determined by the organization.

Monitor counts and latency for denied ownership, verification failures, action conflicts, expired challenges, statement issuance failure, database unavailability, and AI provider timeouts. Alerts and retention windows require environment-specific approval; this repository cannot establish hosted monitoring by itself.

## Local verification

See [the recorded local verification results](VERIFICATION.md) for the checks actually completed and their limits.

Use `pnpm typecheck`, `pnpm test`, and `pnpm audit:dependencies`. `TEST_DATABASE_URL=... pnpm test:database` bootstraps roles and an auth stub and runs every migration plus SQL security tests. **The target must be a fresh disposable PostgreSQL 17 database with pgvector.** The test script does not read the application environment or connect to a configured hosted project. CI runs the same checks.

The synthetic seed requires `app.allow_demo_seed=true` set explicitly in its database session. Cleanup targets only its three deterministic fixture identities. Do not enable this setting on hosted environments. Synthetic users still require their own TOTP enrollment.

## Remaining external release gates

Hosted Supabase grants and Auth configuration, durable log export, backup recovery timing, key management, approved model routing and data retention, actual device secure storage behavior, and production traffic limits need deployment evidence. Passing local tests is not banking certification.

## Authorization preferences (migration 014)

New or previously unconfigured customers must finish authorization setup after login before the mobile chat opens. A database default of TOTP alone does not count as enrollment. Preferences offers PIN, biometrics, and TOTP; changes require a freshly verified account password. Existing accounts are not automatically given a PIN or device key.

PINs are six digits, salted with bcrypt (cost 12), and verified inside a transaction that binds the challenge to the customer, session, action version, and preference version. Five incorrect PIN attempts lock PIN authorization for 15 minutes. Changing the preference invalidates outstanding challenges.

Biometric authorization uses an Ed25519 signing key stored with Expo SecureStore `requireAuthentication` and device-only iOS accessibility. The backend verifies a signature over its own short-lived, one-use challenge. A boolean biometric-success flag is never accepted. This implementation protects the key with native biometric storage but performs signing in JavaScript; it does not claim a non-exportable Secure Enclave key or hardware attestation. Biometric enrollment changes can invalidate the stored key; re-enroll through password-confirmed Preferences. Actual device biometric behavior still needs physical-device verification.

Apply `pnpm dlx supabase@2.117.0 migration up --local` against the configured local stack; no reset or seed is required. The first-login setup lets existing test accounts choose PIN without removing their previously enrolled TOTP factors.
