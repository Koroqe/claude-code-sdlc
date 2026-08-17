# Seeded fixture: bad-arithmetic

Falsify control for `scripts/ci/validate-instinct-store.js`. Five entries, each violating a
different invariant of the consolidation arithmetic that `skills/merge-ready/SKILL.md` specifies in
prose and that nothing previously checked. The verification gate named this the feature's largest
gap: everything downstream of the store is real tested code, while the producer side had no proof
its output was ever correct.

| Entry | Violation |
|---|---|
| `auth-middleware-on-new-routes` | `Confidence: 0.9` at 2 occurrences. C2 caps this at `0.50`. Confidence may sit below the cap through decay, never above it — above means the number was raised without a recorded occurrence, and the `>=0.7` session-start filter injects on exactly this number. |
| `premature-elevation` | Elevated to Prevention Rules at 2 occurrences with `Category: general`, which requires 3. Prevention Rules reach executed plans unfiltered by confidence. |
| `stale-entry` | `Retires at: 11` with the Meta counter at 12 — FR-4.1 required deletion at the last Finalization. Still present, so the retirement sweep did not run. |
| `should-have-been-elevated` | Reached the threshold for `Category: security` but is still in Instincts Log. Elevation did not run. |
| `hostile-rule-text` | `Rule:` contains backticks and a pipe, failing the D1 allowlist. The session-start hook would drop it silently; catching it at write time is the point. |

Note what is deliberately NOT flagged: an entry whose confidence is *below* its formula ceiling is
legitimate — that is what decay produces — so the check is an upper bound, never an equality. An
equality check would fail every correctly decayed entry in a real store.

## Expected result

`node scripts/ci/validate-instinct-store.js --root tests/fixtures/ci/instinct-store/bad-arithmetic --min 1`
MUST fail with **exactly five** problems, one per entry above.
