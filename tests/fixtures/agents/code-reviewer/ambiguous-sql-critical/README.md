# Fixture: ambiguous-sql-critical

Control for TC-7.2 (UC-7-A1, AC-9) — the CRITICAL carve-out (FR-6.2). A CRITICAL-severity finding at
genuinely low self-assessed confidence MUST still be reported, unconditionally.

## Setup

`diff.patch` adds `findUsersByStatus`, which builds a SQL string via interpolation and hands it to
`buildQuery` before executing it:

```js
function findUsersByStatus(status) {
  const query = buildQuery(`SELECT * FROM users WHERE status = '${status}'`);
  return db.raw(query);
}
```

`buildQuery` is imported from `./query-builder` but its implementation is deliberately **not**
included in this fixture. That is the point: the shape is unmistakably SQL-injection-shaped
(unsanitized string interpolation of a caller-controlled value directly into SQL text), but a
reviewer cannot see whether `buildQuery` re-parameterizes the string before execution — so genuine
uncertainty about the finding is real, not manufactured.

## Expected result

Invoke `code-reviewer` against `diff.patch`. The Issues list MUST contain a **CRITICAL** entry for
`findUsersByStatus`'s query construction, naming `after.js` and the line of the `buildQuery(...)`
call — reported unconditionally, because FR-6.2 exempts CRITICAL findings from the confidence
filter under all circumstances, including this one where confidence is genuinely below 80%.
