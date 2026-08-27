# Fixture: conformant-low-severity

Fixture project for TC-14.3 and TC-16.2 (docs/qa/design-capability_test_cases.md) — the
suite's ONLY PASS control. A fully conformant slide-in panel plus exactly two seeded
low-severity findings, proving a PASS verdict still surfaces a non-empty findings table.

## Setup

`.claude/rules/design.md` declares the full system for an invented product (Quench, a
watering scheduler for allotment growers): color tokens with AA-compliant pairs, two font
roles with fallback stacks, a motion scale of exactly 120ms/180ms with a single ease-out
easing, a 4px spacing basis, and a signature element. No preview recipe is declared.

`diff.patch` is the changed-files surface. The panel is deliberately conformant: it traps
focus (Tab/Shift+Tab wrap), closes on Esc, restores focus on close, meets WCAG AA on every
text/background pair, keeps 44px touch targets, uses `:focus-visible` styles, and its
reduced-motion block correctly keeps the opacity feedback while removing only the travel.

Exactly two low-severity findings are seeded — and only these two:

- `src/components/panel.css` — the panel travel uses an introduced `300ms` duration with
  no reasonably-nearby declared token (the scale tops out at 180ms, and a 420px drawer
  legitimately needs more): TC-16.2's genuine-gap case, whose expected finding recommends
  DECLARING a new token — distinct in wording from `tokens-declared-no-preview/`'s reuse
  case, where the introduced value duplicates an existing token's role.
- `src/components/panel.css` — `.panel-accent`'s indigo-violet gradient strip is an
  interchangeable, could-be-any-product visual choice with no tie to the product's declared
  subject or signature element: TC-14.3's anti-slop self-check note.

## Expected result

Invoke `design-reviewer` with `diff.patch` as the changed-files surface. Verdict reads
**Gate 8: PASS**, and the findings table still lists the two low-severity notes — a PASS is
not required to have an empty table (TC-14.3). The 300ms finding's Why column states this
is a genuine gap calling for a new declared token, not reuse of an existing one (TC-16.2).

## Do not add

Never seed a FAIL-worthy violation here — this fixture is the set's only PASS control, and
one focus-trap, contrast, or easing defect destroys it. And never add a preview-recipe
heading to `design.md`, a browser-automation capture dependency (no `package.json` naming
one), or a trust-registry dependency — any of those converts a no-execution fixture into
one that runs repo-controlled commands.
