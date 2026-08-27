# Fixture: design-foundation / low-signal-unattended

A near-zero-signal subject repository for exercising the `design-foundation`
skill in unattended mode. It contains only a bare manifest (`package.json`,
generic name `app`) and one scaffold route (`src/routes/index.jsx`) whose entire
copy is a "Welcome" placeholder. There is deliberately **no** product
description, no audience, no domain vocabulary anywhere in the tree — the
subject genuinely cannot be inferred from what is here. That is what makes
unattended TODO-degradation observable rather than a matter of judgment.

## Expected behavior of an unattended run

An unattended `design-foundation` run against this fixture must:

- make **zero** `AskUserQuestion` calls — unattended means no one is there to
  answer, and stalling on a question is a failure;
- degrade gracefully instead of inventing a subject: every decision it cannot
  ground in the repository is emitted as a labeled
  `TODO(design-foundation):` placeholder, not a fabricated product identity,
  audience, or palette rationale.

## Invariant — keep this fixture greenfield

Never commit a `.claude/rules/design.md` into this fixture. The fixture's value
is that it is a *greenfield* subject with no prior design declaration; a
committed declaration destroys that precondition and every test built on it. If
a run under test writes one here, it must be discarded, never committed.
