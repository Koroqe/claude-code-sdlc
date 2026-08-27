# Fixture: no-design-md

Fixture project for TC-6.3 and TC-9.1 (docs/qa/design-capability_test_cases.md). There is
no `.claude/` directory at all — no `design.md` anywhere in the tree — and no
browser-automation capture dependency, so the review must run against the universal quality
floor only, at evidence-chain step 3.

## Setup

A small invented order-list page with user-facing changes. `diff.patch` is the changed-files
surface. Seeded violation:

- `src/pages/orders.css` — `.orders-link:focus { outline: none; }` removes the default
  focus indicator with no replacement focus style anywhere in the fixture — a violation of
  the universal floor's visible-keyboard-focus rule, detectable at code level.

There is deliberately NO `.claude/rules/design.md`: this fixture exercises the
"no declaration at all" absence note, which is a different case from
`tokens-declared-no-preview/` (declaration present, no preview recipe).

## Expected result

Invoke `design-reviewer` with `diff.patch` as the changed-files surface. The report must
state BOTH facts separately (TC-6.3): the absence note that no `.claude/rules/design.md`
was found — reviewed against the universal floor only (TC-9.1, as a standalone fact) — AND
the literal `no visual evidence — reviewed at code level` line; neither fact substitutes
for the other. The findings table must report the removed focus outline, and a PASS/FAIL
verdict line must be present.

## Do not add

Never add a `.claude/` directory (that flips this fixture into the wrong absence case), a
preview-recipe declaration, a browser-automation capture dependency (no `package.json`
naming one), or a trust-registry dependency — any executable-recipe addition converts a
no-execution fixture into one that runs repo-controlled commands.
