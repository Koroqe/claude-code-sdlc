# Fixture: tokens-declared-no-preview

Fixture project for TC-6.1, TC-6.2, TC-9.3, TC-14.1, TC-16.1, TC-18.1, TC-18.3, TC-19.1 and
TC-19.2 (docs/qa/design-capability_test_cases.md). A full `.claude/rules/design.md` token
declaration exists, but the file has no preview recipe section, and the project ships no
browser-automation capture dependency — so the evidence chain must fall through to step 3
(code-level review) and the report must carry the exact line
`no visual evidence — reviewed at code level`.

## Setup

`.claude/rules/design.md` declares the full system for an invented product (Loomery, a
pattern-drafting workspace for hand weavers): colors including
`--color-accent: #1c6e5f`, two font roles with fallback stacks, a motion scale of exactly
120ms/180ms with a single ease-out easing, a 4px spacing basis, and one signature element.
It deliberately contains no preview recipe heading and no ban-list content.

`diff.patch` is the changed-files surface. The committed files carry these seeded
violations:

- `src/components/Modal.jsx` — overlay with no focus trap, no focus restore on close, and
  no Esc handler (TC-14.1's a11y violation).
- `src/components/Dropdown.css` — `transition: all 400ms ease-in;` — `transition: all`,
  a 400ms dropdown (budget 150-250ms), and `ease-in` on UI in one line (TC-14.1's motion
  violation).
- `src/components/Cta.jsx` — hardcoded `#7c3aed` foreground on a near-tone `#a78bfa`
  background (~2.1:1, under WCAG AA) that also duplicates the declared accent's
  primary-action role: a parallel-token finding (TC-16.1) and a contrast finding (TC-14.1)
  in one element.
- `src/components/Card.css` — an entrance transform/opacity animation with no
  reduced-motion media query anywhere in the fixture (TC-18.1, TC-18.3).

## Expected result

Invoke `design-reviewer` with `diff.patch` as the changed-files surface. The report must:
state that `design.md` exists but declares no preview recipe (the UC-19 wording — never the
UC-9 "no `design.md` found" string, per TC-9.3); contain the literal
`no visual evidence — reviewed at code level` line; audit against the project's own declared
tokens (TC-19.1); rank the focus-trap and contrast findings above the motion-easing finding
(TC-14.1); recommend reusing `--color-accent` for the `#7c3aed` duplication (TC-16.1);
report the missing reduced-motion handling (TC-18.1/18.3); and end with **Gate 8: FAIL**.

## Do not add

Never add a preview-recipe heading to `design.md`, a browser-automation capture dependency
(no `package.json` naming one), or a trust-registry dependency to this fixture — any of
those converts a no-execution fixture into one that runs repo-controlled commands, and
destroys the forced chain-step-3 fall-through every test case above depends on. No ban-list
content either: the ban-list case is `banlist-and-injection/`'s job.
