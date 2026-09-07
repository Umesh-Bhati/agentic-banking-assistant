# 08 — Sign-Up Flow & Profile Preferences

**What to build:** Backend signup/profile APIs and mobile UI for user registration, profile viewing, and auth preference management.

**Blocked by:** 07 — Multi-User Schema

**Status:** done

## Acceptance criteria

- [x] POST /api/auth/signup creates user, profile, default account, sets PIN
- [x] GET /api/profile returns user profile with auth_preference
- [x] PATCH /api/profile/preferences updates auth_preference
- [x] GET /api/profile/products returns user's financial products
- [x] Mobile signup screen with auth preference selector
- [x] Mobile login screen has "Sign Up" link
- [x] Mobile profile menu (top-right avatar) with preferences and logout
- [x] Mobile preferences screen to change auth method
- [x] ChatContext updated with profile state and handlers
