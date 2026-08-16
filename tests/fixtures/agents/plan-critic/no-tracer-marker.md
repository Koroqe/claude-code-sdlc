<!-- Fixture purpose: trips the "no tracer marker anywhere" BLOCKER check
     (FR-5.10(i)). Identical to golden-plan.md except the `**Tracer:** yes`
     marker has been removed from Slice 1 — no slice in this plan is marked
     as the tracer.

     Known, accepted overlap (do not "fix" this away): because this plan
     still has `Wave:` fields, the missing tracer marker necessarily also
     trips the second BLOCKER check — "Wave 1 not tracer-only" — since Wave 1
     cannot contain a tracer slice if no slice anywhere is marked as one.
     That is the literal, intended reading of the Tracer Marker Validation
     section in agents/plan-critic.md ("These two checks run on every plan
     ... independent of whether the plan has Wave: fields"): a no-marker
     waved plan legitimately fails both checks at once. This fixture is
     therefore expected to yield exactly two BLOCKER findings, not one.
     Every other path below resolves under tests/fixtures/plan-critic/project/
     and the Deliverables Checklist carries the CHANGELOG.md entry item, so
     no other finding should fire. -->

# Plan — Widget Status Badge

## Feature Scope

Add a read-only status badge to the widget list page, showing each widget's current lifecycle
state (`active` / `archived` / `pending`). No new data is collected; the state already exists on
the `widgets` table.

**Acceptance criteria:**
- `GET /api/widgets` includes a `status` field in each returned widget object
- The widget list page renders a colored badge next to each widget's name, matching its `status`
- An unauthenticated request to `GET /api/widgets` returns `401`

## Deliverables Checklist

- [x] PRD section: `tests/fixtures/plan-critic/project/docs/PRD.md` — Widget Status Badge
- [x] Use cases: `tests/fixtures/plan-critic/project/docs/use-cases/widget-status-badge_use_cases.md` — 3 scenarios
- [x] Architecture review: PASS
- [x] QA test cases: `tests/fixtures/plan-critic/project/docs/qa/widget-status-badge_test_cases.md` — 6 cases
- [ ] CHANGELOG.md entry (written at merge-ready / standalone fix)

## Implementation Plan

### Slice 1: Wire the status field end-to-end
- **Wave:** 1
- **Use cases:** UC-1.1
- **Files:** `tests/fixtures/plan-critic/project/src/routes/widgets.js`, `tests/fixtures/plan-critic/project/src/app.js`
- **Changes:** route handler adds `status` to the JSON it already returns for each widget; `app.js`
  confirms the route is registered (it already is — no new registration needed)
- **Verify:** `GET /api/widgets` (authenticated) returns each widget with a non-null `status` field;
  `GET /api/widgets` (no `Authorization` header) still returns `401`
- **Done when:** `GET /api/widgets` response includes `status` for every widget in the fixture data,
  and an unauthenticated request still returns `401`
- **Pre-review:** none

### Slice 2: Data layer status column
- **Wave:** 2
- **Use cases:** UC-1.1
- **Files:** `tests/fixtures/plan-critic/project/src/data/widgets.js`
- **Changes:** the existing widget query already selects `status`; add a unit test asserting the
  returned row objects include it
- **Verify:** `npm test -- --grep "widget data layer returns status"`
- **Done when:** the data-layer test asserts `status` is present and one of `active|archived|pending`
- **Pre-review:** none

### Slice 3: Frontend badge component
- **Wave:** 2
- **Use cases:** UC-1.2
- **Files:** `tests/fixtures/plan-critic/project/src/components/WidgetBadge.jsx` [new]
- **Changes:** new presentational component that maps `status` to a badge color and label; rendered
  by the existing widget list component
- **Verify:** `npm test -- --grep "WidgetBadge renders correct color per status"`
- **Done when:** the component test asserts each of the three status values renders its documented
  color and label
- **Pre-review:** none

## Wave Summary

| Wave | Slices | Files (union) | Rationale |
|------|--------|----------------|-----------|
| 1    | 1      | `tests/fixtures/plan-critic/project/src/routes/widgets.js`, `tests/fixtures/plan-critic/project/src/app.js` | Independent — no dependencies |
| 2    | 2, 3   | `tests/fixtures/plan-critic/project/src/data/widgets.js`, `tests/fixtures/plan-critic/project/src/components/WidgetBadge.jsx` | Independent — no shared files, both depend on Wave 1's wiring |

## Acceptance Criteria

- `GET /api/widgets` returns `status` for every widget
- The widget list page shows a correctly colored badge per status
- `GET /api/widgets` without auth returns `401`

## Files to Modify

- `tests/fixtures/plan-critic/project/src/routes/widgets.js` — add `status` to the response
- `tests/fixtures/plan-critic/project/src/app.js` — confirm route registration (no change expected)
- `tests/fixtures/plan-critic/project/src/data/widgets.js` — add coverage for the existing `status` column
- `tests/fixtures/plan-critic/project/src/components/WidgetBadge.jsx` [new] — badge presentation

## Risk Assessment

Low risk: no schema change (the `status` column already exists), no new auth surface (the route is
already auth-gated), display-only change on the frontend.

## Dependencies

None — uses the existing `widgets` table and the existing authenticated `GET /api/widgets` route.
