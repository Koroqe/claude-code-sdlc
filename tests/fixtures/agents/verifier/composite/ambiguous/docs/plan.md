# Plan — owner billing summary

### Slice 1: owner billing summary endpoint
- **Files:** `src/services/billing.js` [new], `src/routes/billing.js` [new], `src/app.js` [new]
- **Changes:** route parses the owner id and returns the billing summary; service calls the external billing SDK's `fetchSummary(ownerId)` and maps the result
- **Verify:** `GET /api/owners/7/billing` returns owner 7's billing summary
- **Done when:** the endpoint returns the billing summary for the requested owner
