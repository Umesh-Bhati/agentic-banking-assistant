# P1: Keep security regression gates mandatory

Status: ready-for-human

CI now runs typechecks, application tests, dependency/secret scans and real PostgreSQL migrations/role tests. Configure protected-branch required checks in the hosting platform. Resolve all dependency audit failures; do not suppress advisories without reviewed reachability evidence and expiry.

Acceptance: branch protection rejects missing/failing security jobs; CI secrets cannot be read by untrusted PR code; immutable action versions and once-only statement fee behavior remain covered; hosted Supabase integration tests exercise actual Auth MFA and session lifecycle separately from local auth-schema stubs.
