# Feature request: reporting engine summary cache

Speed up the reports summary page by caching its aggregate query, and fix the underlying
reporting-engine query so a cache-warm re-run doesn't re-scan the full table.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Bound the reporting engine's core aggregate query in `src/lib/reporting.ts` with an explicit
   row-count cap instead of an unbounded scan.
2. Add a cache layer for the reports summary page in `src/reports/summary.ts`, invalidated when
   the underlying query window changes.
3. Add tests covering both the bounded query and the cache invalidation.
