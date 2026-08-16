# Fixture: markers

One small file per FR-4.1 marker form and per FR-4.2 issue-reference variant, matching
`docs/qa/verification-review-upgrade_test_cases.md` section 6 (TC-4.1–TC-4.18) one for one. Every
file under `src/` is otherwise unremarkable production code — the marker under test is the only
thing that should influence Level 2's finding for that file. `tests/widgets.test.ts` is the one
exception, deliberately placed under the standing exclusion list.

This fixture has no plan, no route, no app — it exists purely to exercise Level 2's scan and tiering
in isolation. Do not add Level 1/3/4 machinery here; that dilutes what each file is a control for.
Invoke `verifier`'s Level 2 scan against each `src/*.js`/`src/*.py` file individually (or the whole
`src/` directory at once) and check the tier/PASS-FAIL result against the table below.

| TC | File | Marker | Same-line reference | Expected tier | Level 2 result |
|---|---|---|---|---|---|
| TC-4.1 | `src/tbd-bare.js` | `TBD` | none | BLOCKER | FAIL |
| TC-4.2 | `src/fixme-bare.js` | `FIXME` | none | BLOCKER | FAIL |
| TC-4.3 | `src/xxx-bare.js` | `XXX` | none | BLOCKER | FAIL |
| TC-4.4 | `src/todo-bare.js` | `TODO` | none | WARNING | PASS |
| TC-4.5 | `src/hack-bare.js` | `HACK` | none | WARNING | PASS |
| TC-4.6 | `src/placeholder-upper.js` | `PLACEHOLDER` | none | WARNING | PASS |
| TC-4.6 | `src/placeholder-lower.js` | `placeholder` | none | WARNING | PASS |
| TC-4.7 | `src/stub-marker.js` | `stub` | n/a (unconditional) | BLOCKER | FAIL |
| TC-4.8 | `src/not-implemented.js` | `not implemented` | n/a (unconditional) | BLOCKER | FAIL |
| TC-4.9 | `src/throw-not-implemented.js` | `throw new Error('Not implemented')` | n/a (unconditional) | BLOCKER | FAIL |
| TC-4.10 | `src/not_implemented_error.py` | `raise NotImplementedError` | present (`#88`) — **must not downgrade** | BLOCKER | FAIL |
| TC-4.11 | `src/pass_todo_compound.py` | `pass  # TODO` (compound) | n/a (unconditional) | BLOCKER | FAIL |
| TC-4.12 | `src/tbd-hash-ref.js` | `TBD` | `#42` (bare digits) | WARNING | PASS |
| TC-4.13 | `src/tbd-jira-ref.js` | `TBD` | `JIRA-456` (project-key) | WARNING | PASS |
| TC-4.14 | `src/tbd-url-ref.js` | `TBD` | `https://github.com/org/repo/issues/42` (URL) | WARNING | PASS |
| TC-4.15 | `src/fixme-hash-ref.js` | `FIXME` | `#7` (bare digits) | WARNING | PASS |
| TC-4.16 | `src/tbd-ref-elsewhere.js` | `TBD` near the top | `#42` near the bottom, separated by unrelated lines — **elsewhere, does not count** | BLOCKER | FAIL |
| TC-4.17 | `src/warning-only.js` | `TODO` + `HACK` + `PLACEHOLDER`, no BLOCKER anywhere | n/a | all WARNING | PASS (3 `gaps` entries) |
| TC-4.18 | `tests/widgets.test.ts` | `TODO` inside a `*.test.ts` file | none | excluded from scan entirely | not scanned, zero findings |

## Do not "fix" these files

Each marker is the only thing under test in its file. Do not remove a marker to "clean up" the code,
do not add a same-line reference to a file whose whole point is having none (TC-4.1–4.3, TC-4.16),
and do not move `tests/widgets.test.ts` out of `tests/` — that would remove the exclusion-list
control and make it a normal production finding.
