# Plan — widget listing (with deferred cleanup notes)

### Slice 1: widget listing endpoint
- **Files:** `src/data/widgets.js` [new], `src/services/widgets.js` [new], `src/routes/widgets.js` [new], `src/app.js` [new], `src/routes/widgets.test.js` [new]
- **Changes:** data layer filters by owner; service validates and maps, with deferred-cleanup notes left inline; route parses the parameter and returns the result; app registers the route; a test calls the route handler directly with a real owner id and asserts on the response body
- **Verify:** `GET /api/owners/7/widgets` returns both of owner 7's widgets
- **Done when:** the endpoint returns owner-scoped widgets and the test passes
