# Isolated local banking demo

Use branch `security/banking-agent-hardening`. This setup uses synthetic fixture customers, a separate Docker project `boit-security-demo`, Supabase API **55321**, PostgreSQL **55322**, Studio **55323**, backend **3001**, and Metro **8082**. Existing projects and servers are preserved.

## Start

Start Docker Desktop, then from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:contracts
pnpm dlx supabase@2.117.0 start
```

The checked-in `supabase/config.toml` enables actual local Auth TOTP and disables public signup and automatic seeding. First startup applies migrations. **Only on a fresh `boit-security-demo` database**, explicitly install synthetic fixtures:

```sh
docker exec -i supabase_db_boit-security-demo psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c 'SET app.allow_demo_seed=true' -f - < supabase/seed.sql
```

Normal restarts do not require seeding. Do not rerun the seed to repair an error: it deletes fixture identities and existing action/audit references may prevent cleanup.

For real AI chat, set a valid approved `OPENROUTER_API_KEY` in ignored `apps/backend/.env` locally. Never send keys in messages or include them in a video. The helper enables OpenRouter with the existing `OPENROUTER_MODEL` (default `openrouter/google/gemini-2.5-flash`) for this synthetic demo and leaves AI disabled for missing/placeholder keys. The `google-vertex/global` endpoint-provider tag is explicitly selected because the current OpenRouter ZDR registry reports a healthy endpoint with support for tool calling and the `max_tokens` field emitted by the SDK. No automatic provider fallback is used. Optional direct OpenAI embeddings remain disabled unless separately approved; approved knowledge search uses a lexical query otherwise.

```sh
node scripts/prepare-local-demo.mjs
cd apps/backend
node --env-file=/private/tmp/boit-demo-runtime/backend.env --import tsx src/index.ts
```

The helper requires Node 22+, checks project/endpoint identity, captures CLI credentials without printing them, and writes a mode-600 environment file outside Git. It preserves the original backend environment. Verify `http://127.0.0.1:3001/ready` returns `{"status":"ready"}`.

In another terminal:

```sh
cd apps/mobile
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm exec expo start --dev-client --port 8082
```

Build and install the native simulator app using the [native build and smoke-test instructions](../../apps/mobile/tests/ui/README.md), including the port-8082 bundle preference if required. Use the development build, not Expo Go, for native security modules. A physical device needs the Mac's reachable local address instead of loopback; HTTP is development-only. Secure storage, biometrics and app-switch behavior still require physical-device testing.

## Synthetic demo and recording

The committed fixture login `prashant@gmail.com` / `prashant123` is reserved for the app recording. The second fixture customer is used for simulator mutation tests so recording cards remain available. These are public synthetic fixtures, never deployment credentials.

Enroll TOTP through the app using the fixture password and a real authenticator. Existing enrollment requires the previously enrolled authenticator; never bypass server policy. During automated setup the recording fixture was enrolled through the actual backend routes; its temporary harness/secret is outside the repo under `/private/tmp/boit-demo-runtime`, mode 600. Do not record/share that secret, QR code, tokens or environment files. Use the untouched third fixture customer (`priyank@gmail.com` / `priyank123`) for your own authenticator enrollment.

Suggested recording: sign in, show accounts, ask to block a card, review the chosen card, enter a current authenticator code, then show confirmed status. For statements, use explicit dates within the last year, review the 25 AED quote and masked debit account, authorize with TOTP, then share the PDF. Account-backed products are supported; loans/card-only products are rejected. AI chat requires a valid approved provider key.

## Stop and rebuild

Stop only the terminals running the demo backend and Metro. From this checkout, `pnpm dlx supabase@2.117.0 stop` preserves the demo database. Do not stop unrelated projects.

To deliberately discard **all this demo's** data, first confirm `project_id = "boit-security-demo"` in `supabase/config.toml`, then run `pnpm dlx supabase@2.117.0 db reset --local` and the explicit seed command above. This removes demo TOTP enrollments/actions. Never use `--linked`, a hosted database URL, or reset another project.

## Live verification evidence

- The isolated Docker stack applied migrations 001–013 successfully against actual Supabase Auth, beyond earlier SQL-only auth stub tests. This is dated historical evidence and does not verify migration 014.
- Password sign-in and backend-approved TOTP enrollment/verification passed for two synthetic customers.
- Actual statement quote returned 25 AED; consent, TOTP challenge and authorization completed the action. A repeated authorization returned the same completed action. Authenticated download returned a valid PDF.
- Database verification found exactly one issued statement and a single debit from 45000.00 to 44975.00 AED after retry. The real banking service created a separate card proposal; actual HTTP selection, confirmation, TOTP challenge and authorization completed it, and the database card status was `BLOCKED`. All three recording customer's cards were still active after these tests. Card proposal testing invoked the banking service directly because AI was unavailable; it does not count as a successful AI tool-call test.
- Backend source/test typechecks and all 65 backend tests passed during that dated demo run. These are historical counts, separate from current automated verification and the actual Auth/banking HTTP checks above.
- A prior direct OpenAI configuration used a placeholder and was rejected. The user uses OpenRouter; chat now preserves that provider and its configured model. Streaming regression tests verify error/empty streams yield an error event without false success or provider diagnostic leakage.
- An earlier OpenRouter check used `openrouter/openai/gpt-4o-mini`; that route is no longer compatible with the enforced ZDR plus `require_parameters` policy because its eligible endpoint does not advertise the SDK's `max_tokens` field. The current guarded live smoke test passed with `openrouter/google/gemini-2.5-flash` restricted to `google-vertex/global`. It used a synthetic prompt, disabled tools and banking mutations, and returned bounded validated text.

Public signup restrictions were applied by normally stopping and starting only the isolated demo stack, preserving its data. Live verification returned HTTP 422 `signup_disabled` for direct Supabase signup, HTTP 200 for existing fixture login, and HTTP 200 with one approved MFA factor. Keep global `[auth].enable_signup=false` and `[auth.email].enable_signup=true`: with CLI 2.117.0, the latter controls the email provider itself; setting it false also disables existing email/password login. The global setting blocks registration. No database reset or reseed was performed.

During native testing Docker was manually closed; Auth became unreachable. Restarting Docker restored the same seeded data and successful password sign-in, without resetting the database. Login now maps transient provider/network failures to HTTP 503 instead of misreporting invalid credentials; genuine invalid credentials remain HTTP 401.
