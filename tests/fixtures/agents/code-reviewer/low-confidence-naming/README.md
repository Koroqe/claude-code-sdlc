# Fixture: low-confidence-naming

Control for TC-7.1 (`docs/qa/verification-review-upgrade_test_cases.md`) — a sub-80%-confidence,
non-CRITICAL naming inconsistency that `code-reviewer` MUST omit entirely from its Issues list.

## Setup

`before.js` already has two lookup helpers, `getUserById` and `getOrderById`, both using the
`get<Noun>ById` verb. `after.js` is the same file with the diff in `diff.patch` applied: it adds a
third helper, `fetchProductById`, using `fetch` instead of `get` for the verb.

This is a genuinely debatable style nit, not a clear defect:
- The file is not 100% consistent on `get` vs `fetch` project-wide (both verbs already appear
  elsewhere in a hypothetical larger codebase), so a reviewer cannot be confident this one function
  is "wrong" rather than "a second, also-acceptable convention."
- It has zero behavioral, security, or correctness impact.
- Reasonable reviewers could disagree on whether it is even worth mentioning.

## Expected result

Invoke `code-reviewer` against `diff.patch`. The Issues list MUST NOT contain any entry referencing
`fetchProductById`'s naming — not as a LOW finding, not as a footnote, not as a caveat in the
Summary. It is simply absent, per FR-6.1's ">80% confidence" bar.

Do not "fix" the naming here — a consistent file destroys the low-confidence control this fixture
exists to provide.
