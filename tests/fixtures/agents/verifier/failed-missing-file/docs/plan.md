# Plan — widget listing with rate limiting

### Slice 1: widget listing endpoint
- **Files:** `src/data/widgets.js` [new], `src/services/widgets.js` [new], `src/routes/widgets.js` [new], `src/app.js` [new], `src/routes/widgets.test.js` [new], `src/middleware/rateLimiter.js` [new]
- **Changes:** data layer filters by owner; service validates and maps; route parses the parameter and returns the result; app registers the route behind a rate-limiting middleware; a test calls the route handler directly and asserts on the response body
- **Verify:** `GET /api/owners/7/widgets` returns both of owner 7's widgets, rate-limited per `src/middleware/rateLimiter.js`
- **Done when:** the endpoint returns owner-scoped widgets, is rate-limited, and the test passes
