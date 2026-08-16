# PRD — plan-critic fixture project

A minimal fixture PRD backing the `plan-critic` agent's committed test fixtures. It exists only so
those fixtures' Deliverables Checklist entries name a real file instead of a phantom path.

## Widget Status Badge

**Problem:** the widget list page shows no indication of a widget's lifecycle state.

**Requirement:** `GET /api/widgets` returns each widget's `status` (`active` / `archived` / `pending`),
and the widget list page renders a colored badge reflecting it.

**Acceptance criteria:**
- `GET /api/widgets` includes a `status` field in each returned widget object
- The widget list page renders a colored badge next to each widget's name, matching its `status`
- An unauthenticated request to `GET /api/widgets` returns `401`
