# Banking mobile application

Use `pnpm --filter @boit/mobile start`, `pnpm --filter @boit/mobile typecheck`, and `pnpm --filter @boit/mobile test` from the repository root.

Set `EXPO_PUBLIC_API_URL` to the bank API origin. Release builds require HTTPS with no embedded credentials, query, fragment or path. Development builds may use the local backend; use synthetic fixtures only. Do not share account credentials or expose production data through development tunnels.

## Security boundaries

- `lib/api` provides fixed-origin, header-authenticated, bounded requests and cancellation through body consumption. Mutations are never automatically retried. A 401 clears the current local session.
- `features/auth/services` stores native refresh/access tokens with device-only unlocked Keychain access and Android backup exclusion. Browser sessions stay in memory. Local biometrics only unlock a stored session; the backend revalidates every unlock. Backgrounding clears financial state and aborts requests. Password sign-in remains available when local biometrics are unavailable.
- `features/chat/services` contains the single SSE transport and versioned UI envelope validation. Model prose, JSON, URLs and tool calls are inert text. Historical legacy controls are not replayed. Bank UI comes from the authenticated server's separate typed events.
- `features/actions/services` performs explicit confirmation, server MFA challenges, authorization, status and cancellation. Enrollment requires a real authenticator; pending enrollment can be resumed after switching apps. Secret setup keys are never persisted by the application.
- Statement fees require explicit consent and MFA. PDF requests use a persisted ID. Native exports use an app cache file removed when sharing settles; logout/background removes other cached statements and cancels pending downloads. An explicit active share remains available to its recipient until the share sheet completes. The user controls exported copies afterward.

## Release evidence still required

Automated tests cover protocol trust boundaries, origin/path restrictions, fragmented SSE, HTTP failures, authorization headers, pending body cancellation and export cleanup. Typechecking covers the native UI against installed SDK types.

Before deploying to actual devices, verify iOS/Android biometric prompts, refresh rotation, revocation, authenticator switching/resume, background privacy, share-sheet lifetime, and downloaded file protection. Fetch requests request `redirect: 'error'`; native redirect handling must be verified on both release builds, and the API/proxy must not redirect authenticated routes. Checking the final response URL alone does not prevent credentials being sent by a native redirect. Expo Go does not establish release-build security behavior.

Production banking remains disabled until the repository security release gates and independent assessment are complete.

The native target uses the Expo SDK-matched Metro runtime (57.0.15). The optional browser target still needs the SDK-matched React DOM / React Native Web installation and browser integration testing before it can be supported. The existing unused Jest Native test dependency pulls a mismatched React test renderer; the current Vitest security suite does not load that renderer. Resolve its version pairing before adding native component-renderer tests.
