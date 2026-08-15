# Plan — plugin dispatch endpoint

### Slice 1: dynamic plugin dispatch route
- **Files:** `src/plugins/widgetPlugin.js` [new], `src/pluginLoader.js` [new], `src/app.js` [new], `src/server.js` [new]
- **Changes:** the loader eagerly validates the built-in widget plugin at startup, and separately dispatches to a plugin chosen by the request's `:name` parameter at request time; the app registers the dispatch route; the server boots the app
- **Verify:** `POST /api/plugins/widgetPlugin/run` invokes the widget plugin's `run()` export
- **Done when:** the dispatch route resolves and invokes the named plugin
