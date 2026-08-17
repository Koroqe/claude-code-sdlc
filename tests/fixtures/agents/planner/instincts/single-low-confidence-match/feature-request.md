# Feature request: remember-device trusted session extension

Add a "remember this device" option to login that extends session lifetime for trusted devices,
without weakening the existing auth flow for untrusted ones.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add a `trustedDevice` boolean column and a migration for the `sessions` table.
2. Add the "remember this device" checkbox to the login form and thread the flag through the
   login request payload.
3. Update the token-refresh path in `src/middleware/auth.ts` to read the `trustedDevice` flag and
   apply the extended TTL when a session token is refreshed.
4. Add tests covering both the trusted-device and untrusted-device refresh paths.
