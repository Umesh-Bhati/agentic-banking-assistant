# Agentic Banking Assistant

A banking assistant built with **Expo / React Native**, **Fastify**, **Mastra**, **OpenRouter**, and **Supabase**. Supports account queries, card blocking, and PDF statement downloads using synthetic local banking data.

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
OPENROUTER_MODEL=openrouter/openai/gpt-4o-mini
PORT=3000
```

Chat uses **OpenRouter**; a direct OpenAI API key is not required. Keep API keys in the backend environment file and out of Git.

Start the backend:

```sh
cd apps/backend
pnpm dev
```

Leave it running. The backend is available at **http://localhost:3000**; `/ready` returns `{"status":"ready"}` when its readiness checks pass.

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

## Local login and banking flows

Use a seeded synthetic account, for example **`priyank@gmail.com` / `priyank123`**. Public signup is disabled.

After login, users without an authorization preference are taken to setup. Choose **Banking PIN**, **Biometrics**, or **Authenticator code (TOTP)** and complete enrollment before entering chat. Confirm changes with your account password. You can change the method later under **Profile → Preferences**.

Banking PIN uses six digits you choose. Biometrics requires an enrolled Face ID or fingerprint on this device. TOTP requires adding the displayed setup key to an authenticator app and verifying its current code. An already enrolled TOTP account requires its existing authenticator, or you can choose PIN / biometrics instead.

- **Block card:** ask “Block my card,” select the card in the response, and authorize using your saved method.
- **Download statement:** request an account statement with explicit dates within the last year, review and accept the fee, authorize, then select **Save / share PDF**.

Card blocks and statement fees persist in the local database. Banking operations use your saved authorization method. PIN attempts are limited; biometric approvals require a server-verified device signature.

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
pnpm test
```
