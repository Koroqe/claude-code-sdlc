# Fixture: silent-failures

Control for TC-8.1 through TC-8.6 (`docs/qa/verification-review-upgrade_test_cases.md`, UC-8) — the
four silent-failure shapes (a)-(d) from FR-7.1, and the CRITICAL-vs-HIGH severity split from FR-7.2
("data-mutation **or** financial code path" — either condition alone is enough).

Each file below is a standalone new-file addition (see `diff.patch`); every line in each file counts
as "inside the diff" so none of these are affected by diff-scoping — they exist purely to probe the
silent-failure checklist item and its severity rule.

| File | Shape | Context | Expected severity | TC |
|---|---|---|---|---|
| `case-a-critical-empty-catch-mutation.js` | (a) empty `catch {}` | DB write (widget update) | CRITICAL | TC-8.1 |
| `case-a-high-empty-catch-readonly.js` | (a) empty `catch {}` | optional analytics ping (no write) | HIGH | TC-8.2 |
| `case-b-catch-coerced-default.js` | (b) `.catch(() => [])` | related-products suggestion fetch (no write) | HIGH | TC-8.3 |
| `case-c-logger-only-catch.js` | (c) logger-only catch | order-status DB write | CRITICAL | TC-8.4 |
| `case-d-no-catch-at-all.js` | (d) no catch/try at all | cached settings fetch (no write) | HIGH | TC-8.5 |
| `case-financial-critical.js` | (a) empty `catch {}` | balance calculation, no DB write, feeds a charge | CRITICAL | TC-8.6 |

`case-financial-critical.js` is the fixture that proves the "financial" half of FR-7.2's disjunction
is sufficient on its own — there is no data mutation anywhere in that file. If a reviewer only checks
for mutation and misses this file, that is the specific defect this fixture exists to catch.

## Expected result

Invoke `code-reviewer` against each file (or the combined `diff.patch`). Every one of the six MUST
appear as a Silent Failures finding tagged with the severity in the table above — the CRITICAL rows
are reported unconditionally (confidence filter and diff-scoping both carve out CRITICAL); the HIGH
rows are subject to the normal >80%-confidence and diff-scoping rules like any other HIGH finding.
