<!-- Fixture purpose: AC-4 differential test. Used to run BOTH the captured
     pre-migration prompt (pre-migration-prompt.md) and the extracted
     agents/plan-critic.md against identical input and diff their FINDINGS
     output. Exactly one injected defect: Slice 2 and Slice 3 are both
     assigned to Wave 2 and both declare
     `tests/fixtures/plan-critic/project/src/data/widgets.js` in their
     `Files:` list — the classic shared-file-within-a-wave CRITICAL/BLOCKER
     finding this check exists to catch. Everything else in the plan is
     otherwise clean (tracer present, Wave 1 solo, correct Files (union),
     every other path resolves under tests/fixtures/plan-critic/project/, and
     the Deliverables Checklist carries the CHANGELOG.md entry item), so the
     two prompts' findings can be compared on this single defect without
     noise from unrelated checks. -->

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

### Slice 1: Wire the status field end-to-end (tracer)
- **Tracer:** yes
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
- **Files:** `tests/fixtures/plan-critic/project/src/data/widgets.js`, `tests/fixtures/plan-critic/project/src/components/WidgetBadge.jsx` [new]
- **Changes:** new presentational component that maps `status` to a badge color and label; rendered
  by the existing widget list component. Also touches
  `tests/fixtures/plan-critic/project/src/data/widgets.js` to add a memoized selector the component
  consumes.
- **Verify:** `npm test -- --grep "WidgetBadge renders correct color per status"`
- **Done when:** the component test asserts each of the three status values renders its documented
  color and label
- **Pre-review:** none

## Wave Summary

| Wave | Slices | Files (union) | Rationale |
|------|--------|----------------|-----------|
| 1    | 1      | `tests/fixtures/plan-critic/project/src/routes/widgets.js`, `tests/fixtures/plan-critic/project/src/app.js` | Tracer — thinnest end-to-end path, occupies Wave 1 alone |
| 2    | 2, 3   | `tests/fixtures/plan-critic/project/src/data/widgets.js`, `tests/fixtures/plan-critic/project/src/components/WidgetBadge.jsx` | Independent — no shared files, both depend on Wave 1's wiring |

## Acceptance Criteria

- `GET /api/widgets` returns `status` for every widget
- The widget list page shows a correctly colored badge per status
- `GET /api/widgets` without auth returns `401`

## Files to Modify

- `tests/fixtures/plan-critic/project/src/routes/widgets.js` — add `status` to the response
- `tests/fixtures/plan-critic/project/src/app.js` — confirm route registration (no change expected)
- `tests/fixtures/plan-critic/project/src/data/widgets.js` — add coverage for the existing `status` column, and a selector for Slice 3
- `tests/fixtures/plan-critic/project/src/components/WidgetBadge.jsx` [new] — badge presentation

## Risk Assessment

Low risk: no schema change (the `status` column already exists), no new auth surface (the route is
already auth-gated), display-only change on the frontend.

## Dependencies

None — uses the existing `widgets` table and the existing authenticated `GET /api/widgets` route.
