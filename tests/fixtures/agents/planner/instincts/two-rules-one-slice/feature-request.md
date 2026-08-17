# Feature request: reports CSV export

Add a "download as CSV" button to the reports page.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add a `GET /api/reports/export` endpoint in `src/routes/reports.ts` that streams the current
   report's rows as CSV.
2. Add the "download as CSV" button to the reports page UI and wire it to the new endpoint.
3. Add tests covering both the export endpoint and the button's request wiring.
