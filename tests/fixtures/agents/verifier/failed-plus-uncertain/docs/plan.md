# Plan — widget listing (rate-limited) and report plugin dispatch

### Slice 1: widget listing endpoint
- **Files:** `src/data/widgets.js` [new], `src/services/widgets.js` [new], `src/routes/widgets.js` [new], `src/app.js` [new], `src/middleware/rateLimiter.js` [new]
- **Changes:** data layer filters by owner; service validates and maps; route parses the parameter and returns the result; app registers the route behind a rate-limiting middleware
- **Verify:** `GET /api/owners/7/widgets` returns both of owner 7's widgets, rate-limited per `src/middleware/rateLimiter.js`
- **Done when:** the endpoint returns owner-scoped widgets and is rate-limited

### Slice 2: dynamic report plugin loader
- **Files:** `src/plugins/reportPlugin.js` [new], `src/services/loader.js` [new], `config/pluginName.json` [new]
- **Changes:** a loader reads the configured plugin name from `config/pluginName.json` at runtime and dynamically imports the matching plugin module by computed path
- **Verify:** the configured plugin is loaded and its `run()` export is invoked
- **Done when:** the loader dispatches to the plugin named in config
