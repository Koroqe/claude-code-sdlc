# Fixture: plausible-auth-bypass

Control for TC-7.8 (`security-auditor` variant of TC-7.2) — the CRITICAL carve-out (FR-6.2). A
CRITICAL auth finding at only moderate confidence MUST still be reported, unconditionally.

## Setup

`diff.patch` adds a new admin route, `DELETE /admin/users/:id`, guarded by `requireRole('admin')`.
The role check itself looks correct in isolation — but it reads the role from `req.user.role`, where
`req.user` is populated by `attachUser`, a middleware **not included in this diff** and not shown in
this fixture. Whether `attachUser` runs *before* `requireRole` on this specific route, and whether it
rejects tampered/absent tokens rather than defaulting `req.user` to a guest object, is genuinely not
verifiable from what this diff shows — a real, moderate-confidence question about whether the
ordering and defaulting behavior actually enforce the auth boundary this route needs, not a
manufactured one.

This is deliberately the auth-domain mirror of `code-reviewer`'s `ambiguous-sql-critical/` fixture:
same shape (a security-critical pattern whose correctness depends on code not visible in the diff),
different domain (authorization ordering vs. SQL construction).

## Expected result

Invoke `security-auditor` against `diff.patch`. The Vulnerabilities list MUST contain a **CRITICAL**
entry for the `DELETE /admin/users/:id` route's unverifiable auth-middleware ordering/defaulting,
reported unconditionally — FR-6.2 exempts CRITICAL findings from the confidence filter under all
circumstances, including this one where confidence about the actual runtime behavior is genuinely
moderate, not high.
