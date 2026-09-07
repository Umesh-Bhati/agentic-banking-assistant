# 10 — Transaction Security & Policy Enforcement

**What to build:** Enforce per-user auth method in PinModal, add credentials auth, remove all hardcoded user IDs, strict ownership validation.

**Blocked by:** 09 — Deterministic Service Workflows

**Status:** done

## Acceptance criteria

- [x] PinModal renders ONLY the user's configured auth method (PIN pad / biometrics / credentials form)
- [x] CREDENTIALS auth re-verifies email+password via Supabase Auth
- [x] All hardcoded user/account IDs removed from tools and services
- [x] Strict ownership checks (no bypass) in AuthorizationService
- [x] User A cannot see/act on User B's data (multi-user isolation)
- [x] Authorization service supports all 3 methods: PIN, BIOMETRIC, CREDENTIALS
