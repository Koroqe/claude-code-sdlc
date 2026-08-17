# Feature request: saved search filters

Let a user save their current search filter combination under a name and reapply it later.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add a `saved_filters` table and migration.
2. Add `POST /api/saved-filters` and `GET /api/saved-filters` endpoints.
3. Add the "save this search" and "apply a saved search" UI controls.
4. Add tests covering create, list, and apply.
