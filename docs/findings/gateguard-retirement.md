# Decision: `pre:edit:gateguard` is retired, not deferred

## The rule that fired

The v4.0 roadmap fixed GateGuard's promotion criteria **in advance**, specifically so that
"default-off" could not quietly become "permanently off":

> on for 10 consecutive slices; promoted to default only if merge-ready first-pass gate failures drop
> and no slice is blocked >2 turns. **Reviewed at F5 kickoff; if unmeasured by then it is removed, not
> left permanently off.**

F5 has shipped. GateGuard was never implemented — `hooks/handlers/` contains no gateguard file, and
`hooks/hooks.json` has no registration. It is therefore unmeasured, and the rule's own consequence
applies: **removed**.

## Why this is the right outcome, not merely the mandated one

Section 8's Design Decision 9 already recorded the substantive case for not shipping it, and that
reasoning has only strengthened:

- Every other guard mechanizes a rule **already known to matter** — never commit on `main`, no AI
  attribution, re-read before edit. GateGuard mechanizes a **hypothesis**: that forcing the model to
  state who imports a file, and to quote the current instruction verbatim, before its first edit
  produces better output. That hypothesis was never tested.
- Being opt-in (`SDLC_GATEGUARD=on`), shipping it could never start its own measurement window.
  Nothing forces a project to enable it, so the 10-slice criterion had no way to be satisfied.
- It would add a second session-scoped state library and per-edit latency to a pipeline whose hook
  layer is already on the critical path of every tool call.

Retiring it is not a judgement that fact-forcing is worthless. It is a judgement that an unmeasured,
opt-in mechanism sitting permanently at zero adoption is indistinguishable from absent — and the
roadmap said so first.

## What changes

- The hook slot it reserved returns to the budget. The v4.0 ceiling is 12; retiring GateGuard is what
  keeps the recently added diagnostics inside it without special pleading.
- `tests/hooks/test-guards-cross.js` still asserts no gateguard registration exists. The assertion is
  unchanged; its label now says **retired** rather than deferred, so the test states a decision
  instead of implying pending work.
- Section 8's Design Decision 9 and Risk 4 remain as written. They are accurate history — the
  decision to defer *was* correct at the time. This document records the later decision that the
  deferral has now converted into a retirement.

## If someone wants it back

It needs a PRD section of its own with a falsifiable hypothesis, a measurement plan that does not
depend on voluntary opt-in, and a hook slot accounted for against the then-current budget. Reviving
it as "the seventh guard we always meant to ship" would reproduce exactly the state this decision
exists to end.
