# Dependency compatibility patches

`decode-uri-component@0.5.0.patch` lets query-string 7 (used by Expo Router) consume
the security-fixed decoder through CommonJS. It changes the package module type
and the single function export; the upstream UTF-8 decoding fix is preserved.
It also replaces dynamic regular-expression replacement with literal split/join:
large malformed encoded runs otherwise throw “Regular expression too large”, and
decoded dollar signs must remain literal rather than replacement patterns.

The root override is scoped to query-string 7.1.3. Remove the override and patch
when its upstream dependency supports a fixed decoder directly. UUID 11.1.1 is
scoped to xcode 3.0.1 because it is patched and still supports xcode's CommonJS
`uuid.v4()` call; UUID 12 and later do not retain that module interface.

Run `pnpm test:dependencies` and `pnpm audit:dependencies` after changing either.
The tests exercise the installed Expo dependency chains and bound malformed-input
execution in a child process so a decoder regression cannot hang CI.

Upstream references:
- https://github.com/SamVerschueren/decode-uri-component/tree/v0.5.0
- https://github.com/advisories/GHSA-vcc3-ghjq-m6fr
- https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md
- https://github.com/advisories/GHSA-w5hq-g745-h8pq
