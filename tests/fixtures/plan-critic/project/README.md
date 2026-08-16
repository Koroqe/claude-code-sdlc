# Fixture: plan-critic project

A minimal, self-contained "hypothetical app" tree that backs every `plan-critic` plan fixture:

- `tests/fixtures/agents/plan-critic/golden-plan.md`
- `tests/fixtures/agents/plan-critic/no-tracer-marker.md`
- `tests/fixtures/agents/plan-critic/wave1-non-tracer.md`
- `tests/fixtures/agents/plan-critic/union-mismatch.md`
- `tests/fixtures/plan-critic/defective-plan.md`

Those plans describe a fictional "Widget Status Badge" feature for an Express/React app. Before this
tree existed, every `Files:` path and Deliverables Checklist path they named was phantom (nothing
under `src/...` or `docs/...` resolves at repo root), so `plan-critic`'s File Path Verification check
fired identically on all five plans regardless of each plan's own single injected defect (or lack of
one) — noise that made the golden plan a weak negative control.

This tree exists so those same paths resolve for real, under
`tests/fixtures/plan-critic/project/...`. The plan fixtures reference files here using that full
repo-relative path (e.g. `tests/fixtures/plan-critic/project/src/routes/widgets.js`), so File Path
Verification resolves them from the repository root exactly as it would resolve any other path in a
plan.

`src/components/WidgetBadge.jsx` deliberately does NOT exist in this tree — every plan fixture marks
it `[new]`, and a `[new]`-marked path is expected not to resolve yet.
