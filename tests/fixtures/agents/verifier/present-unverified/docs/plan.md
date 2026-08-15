# Plan — widget listing

### Slice 1: widget listing endpoint
- **Files:** `src/data/widgets.js` [new], `src/services/widgets.js` [new], `src/routes/widgets.js` [new], `src/app.js` [new]
- **Changes:** data layer filters by owner; service validates and maps; route parses the parameter and returns the result; app registers the route
- **Verify:** `GET /api/owners/7/widgets` returns both of owner 7's widgets
- **Done when:** the endpoint returns owner-scoped widgets
