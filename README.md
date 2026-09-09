# Agentic Banking Assistant

A banking assistant built with **Expo / React Native**, **Fastify**, **Mastra**, **OpenRouter**, and **Supabase**. It supports account queries, card-block proposals, and PDF statement requests using synthetic local banking data.

The LLM is not banking authority. It can select narrowly scoped tools and propose an action, but authenticated services, trusted UI controls, fresh customer authorization, and atomic PostgreSQL functions determine whether an action executes.

> This repository is a security-focused simulator, not a production banking system. Do not connect it to real banking infrastructure or import real customer data.

## Prerequisites

- Node.js 22+ and pnpm 9.15.0
- Docker Desktop, running before starting Supabase
- An OpenRouter API key
- Xcode for iOS Simulator, or Android Studio for Android Emulator

## 1. Install dependencies

Clone the repository and open its directory, then run:

```sh
pnpm install --frozen-lockfile
pnpm build:contracts
```

These instructions match the `security/banking-agent-hardening` branch.

## 2. Set up Supabase locally

From the repository root:

```sh
pnpm dlx supabase@2.117.0 start
```

This starts the Docker services and applies migrations on a fresh database. The project's local Supabase API runs on **55321**, and Studio is available at **http://127.0.0.1:55323**.

Seed the synthetic users and banking records **once, on a fresh database**:

```sh
docker exec -i supabase_db_boit-security-demo psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c 'SET app.allow_demo_seed=true' -f - < supabase/seed.sql
```

Automatic seeding is disabled. Do not seed again when restarting; the seed replaces fixture identities.

When updating an existing checkout, apply new migrations without reseeding:

```sh
pnpm dlx supabase@2.117.0 migration up --local
```

Get the local API keys for the next step:

```sh
pnpm dlx supabase@2.117.0 status -o env
```

## 3. Configure the backend

Create `apps/backend/.env` with the following values. Copy `ANON_KEY` and `SERVICE_ROLE_KEY` from the Supabase status output into the corresponding settings:

```dotenv
SUPABASE_URL=http://127.0.0.1:55321
SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_KEY=your_local_service_role_key
BANKING_MODE=simulator
BANKING_MUTATIONS_ENABLED=true
AI_ENABLED=true
APPROVED_AI_PROVIDERS=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/google/gemini-2.5-flash
# Comma-separated OpenRouter provider slugs. Required when OpenRouter AI is enabled.
OPENROUTER_ALLOWED_PROVIDERS=google-vertex/global
# Optional privacy-filtered operational traces; disabled by default.
AI_OBSERVABILITY_ENABLED=false
PORT=3000
```

Chat uses **OpenRouter**; a direct OpenAI API key is not required unless OpenAI embeddings are enabled separately. OpenRouter requests enforce zero-data retention, deny provider data collection, require support for every requested model parameter, disable implicit provider fallback, and use only the configured provider allowlist. The allowlist is an OpenRouter endpoint-provider tag, not the model vendor: `google/gemini-2.5-flash` currently has a healthy ZDR-compatible `google-vertex/global` endpoint with tool-calling and `max_tokens` support. OpenRouter maintains the live compatibility list at `https://openrouter.ai/api/v1/endpoints/zdr`; re-check it before changing models or providers. Keep all API keys in the backend environment file and out of Git.

Set `AI_OBSERVABILITY_ENABLED=true` only when local operational traces are needed. Exported spans are projected onto a narrow allowlist and exclude prompts, model output, tool arguments/results, credentials, customer identifiers, financial data, and reasoning content.

Start the backend:

```sh
cd apps/backend
pnpm dev
```

Leave it running. The backend is available at **http://localhost:3000**; `/ready` returns `{"status":"ready"}` when its readiness checks pass.

### Debugging backend and AI failures

Fastify writes structured Pino JSON logs. Correlate all entries for one request with `reqId` / `requestId`. During local development, an `ai_response_failed` entry is logged at error level and includes an `err` object with the failure message, stack, and any provider error preserved as its cause. Production deliberately omits those details because provider diagnostics can contain sensitive request data.

The chat route uses Server-Sent Events (SSE). A `request completed` entry with `statusCode: 200` means the SSE connection was opened successfully; it does not guarantee that model generation completed. The definitive success signal is `event: "ai_response_completed"`. If generation fails after the stream opens, the server logs `event: "ai_response_failed"` (or `ai_response_aborted`) and sends a terminal SSE event with `type: "error"`.

## 4. Run the Expo mobile app

Create `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000
```

Use `http://10.0.2.2:3000` for Android Emulator. For a physical phone, use your computer's LAN IP instead of `127.0.0.1`, and connect both devices to the same network. Never put backend secrets in this file.

In a new terminal, from the repository root:

```sh
cd apps/mobile
pnpm expo run:ios
```

Or, for Android:

```sh
cd apps/mobile
pnpm expo run:android
```

These commands build and install the native app and start Metro. Use this native build for the banking security features; Expo Go is not the supported setup.

Once the app is installed, start Metro for subsequent development sessions and open the installed app:

```sh
cd apps/mobile
pnpm expo start
```

Restart Metro after changing `.env`. Rebuild the native app after changing native dependencies.

On Android, the chat composer uses `react-native-keyboard-controller` with Expo's frame-by-frame keyboard-height pattern and `android.softwareKeyboardLayoutMode: "resize"`. Keyboard Controller is a native dependency and is not available in Expo Go. After pulling this change, rebuild and reinstall the development app with `pnpm expo run:android`; restarting Metro alone is not enough.

## Local login and banking flows

Use a seeded synthetic account, for example **`priyank@gmail.com` / `priyank123`**. Public signup is disabled.

After login, users without an authorization preference are taken to setup. Choose **Banking PIN**, **Biometrics**, or **Authenticator code (TOTP)** and complete enrollment before entering chat. Confirm changes with your account password. You can change the method later under **Profile → Preferences**.

Banking PIN uses six digits you choose. Biometrics requires an enrolled Face ID or fingerprint on this device. TOTP requires adding the displayed setup key to an authenticator app and verifying its current code. An already enrolled TOTP account requires its existing authenticator, or you can choose PIN / biometrics instead.

- **Block card:** ask “Block my card,” select the card in the response, and authorize using your saved method.
- **Download statement:** request an account statement. If the account or period is missing, reply to the follow-up with a displayed account position and exact start/end dates (for example, `first account, 2026-08-01 to 2026-08-31`). Review and accept the quote, authorize, then select **Save / share PDF**.

Card blocks and statement fees persist in the local database. Banking operations use your saved authorization method. PIN attempts are limited; biometric approvals require a server-verified device signature.

## Agent safety model

The agent uses defense in depth rather than relying on its system prompt:

- Incoming messages are bounded, privacy-minimized, and screened for high-confidence instruction hijacking and system-prompt extraction.
- Every request receives an explicit tool allowlist. Ordinary requests can use read-only tools; mutation-proposal tools are exposed only for classified card-block or statement requests.
- Tool inputs and outputs use Zod schemas. Tool execution requires authenticated request context and customer-scoped resource aliases.
- Private balances, transactions, product records, and card details are sent through authenticated server UI events; the model receives only temporary aliases.
- Retrieved documents are treated as untrusted data and must be administrator-approved and effective before search can return them.
- Model-generated JSON is inert text. Only schema-validated, server-originated UI events can initiate trusted action controls.
- Model prose is buffered and validated as a complete response before release. This intentionally replaces token-by-token text streaming so a late unsafe chunk cannot leak an earlier prefix.
- Card blocks and paid statements require trusted UI confirmation plus fresh PIN, biometric-signature, or TOTP authorization. Action versions, expiries, ownership checks, one-use challenges, row locks, and idempotency are enforced outside the model.
- `AI_ENABLED` and `BANKING_MUTATIONS_ENABLED` are independent kill switches.

See [the threat model](docs/security/THREAT-MODEL.md), [security operations](docs/security/OPERATIONS.md), and [verification evidence](docs/security/VERIFICATION.md) for trust boundaries, release requirements, and residual risks.

See [the current architecture](Architecture-Spec.md), [domain language](CONTEXT.md), and [architecture decisions](docs/adr/) for the implemented application structure and terminology.

## Stop and restart

Stop the backend and Metro with `Ctrl+C`. To stop Supabase while preserving its data, run from the repository root:

```sh
pnpm dlx supabase@2.117.0 stop
```

Next time, open Docker Desktop, run `pnpm dlx supabase@2.117.0 start`, start the backend with `pnpm dev`, and start mobile with `pnpm expo start`. **No reseeding is needed.**

## Checks

From the repository root:

```sh
pnpm typecheck
pnpm eval:agent
pnpm test
pnpm audit:dependencies
```

`pnpm eval:agent` is an offline security gate. It runs policy cases, real Mastra agent trajectories with a mock model, chat-route integration tests, provider/privacy checks, tool/schema boundaries, interruption handling, and step/tool limits. It does not call a live model.

Database security tests require a fresh database on a dedicated disposable PostgreSQL 17 cluster. The script creates cluster-global test roles and refuses to run without an explicit acknowledgement:

```sh
BOIT_DISPOSABLE_TEST_CLUSTER=I_ACKNOWLEDGE_THIS_CLUSTER_IS_DISPOSABLE \
TEST_DATABASE_URL=postgresql://test_user:synthetic_password@127.0.0.1:5432/boit_security_test \
pnpm test:database
```

Never point this command at a hosted, shared, development, or production database cluster.

An optional live-provider smoke test exists, but it is intentionally excluded from CI and refuses to run unless all safety flags are explicit and banking mutations are disabled:

```sh
LIVE_AGENT_EVALS=true \
AI_EVAL_SYNTHETIC_ONLY=true \
AI_ENABLED=true \
BANKING_MUTATIONS_ENABLED=false \
pnpm eval:agent:live
```

The live smoke test still requires the approved provider, model, key, and OpenRouter allowlist configuration described above. It uses no customer context and disables tools; it is not an adversarial model certification.

Current non-database verification covers 150 passing tests and 46 executable agent-security checks. The current 14-migration database suite and live provider behavior remain unverified in this working tree; passing local checks is not banking certification.
