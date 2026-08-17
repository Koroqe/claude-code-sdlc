# Feature request: relative timestamps in the dashboard widget and the notifications list

Show "3 minutes ago"-style relative timestamps in two places that currently show raw ISO strings.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add relative-time formatting to the dashboard summary widget, using the shared helper in
   `src/lib/dateFormat.ts` (extend the helper if it does not yet support the needed granularity).
2. Add a second, unrelated dashboard widget's loading-state polish (no relative-time work).
3. Add relative-time formatting to the notifications list, also going through
   `src/lib/dateFormat.ts` for the shared helper — the identical formatting rule as Slice 1.
4. Add tests covering both the dashboard widget's and the notifications list's relative-time output.
