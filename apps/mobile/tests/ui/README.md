# Native simulator smoke test

These Maestro flows exercise the installed app against an actual local backend.
They do not mock authentication, MFA, or model responses. Use synthetic accounts
only. Enroll the fixture's authenticator through the normal API before recording;
never record its setup key or terminal credentials.

Start the isolated backend, then run Metro using its actual port:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm exec expo start --localhost --port 8082
```

From `apps/mobile`, build the native simulator app in another terminal:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:3001 RCT_METRO_PORT=8082 pnpm exec expo run:ios --no-bundler
```

If a prebuilt React Native binary still selects its default port 8081, configure
the simulator's debug bundle preference and relaunch:

```sh
xcrun simctl spawn booted defaults write ae.almasraf.mobile RCT_jsLocation -string 127.0.0.1:8082
xcrun simctl terminate booted ae.almasraf.mobile
xcrun simctl launch booted ae.almasraf.mobile
```

Set `DEMO_EMAIL` and `DEMO_PASSWORD` to the synthetic fixture credentials in your
local shell, then run the flow using an installed Maestro CLI:

```sh
MAESTRO_CLI_NO_ANALYTICS=1 maestro test -e DEMO_EMAIL="$DEMO_EMAIL" -e DEMO_PASSWORD="$DEMO_PASSWORD" tests/ui/login-security.yaml
```

The flow requires the app to start signed out. It checks real login, the
server's verified authenticator state, locking after backgrounding, fresh login,
and logout. It passed on the iPhone 17 Pro simulator with iOS 26.5 on 2026-09-08.
It does not prove completion of a banking operation or successful AI
orchestration. Those require additional live checks.

Record only the simulator screen, keep the raw recording, and put shareable
exports in the ignored `artifacts/demo/` directory. Check the complete recording
for private information before sharing. Real AI workflows require an explicitly
enabled provider and valid local credentials; do not substitute fake responses.

The recorded walkthrough is `artifacts/demo/security-smoke-demo.mp4`, with the
unmodified source capture at `artifacts/demo/security-smoke-final-raw.mov` and
scope notes in `artifacts/demo/README.md`. The recording splits this flow at the
security screen to hold the verified configuration long enough to read.
