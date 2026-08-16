# Plan — report plugin dispatch

### Slice 1: dynamic report plugin loader
- **Files:** `src/plugins/reportPlugin.js` [new], `src/services/loader.js` [new], `config/pluginName.json` [new]
- **Changes:** a loader reads the configured plugin name from `config/pluginName.json` at runtime and dynamically imports the matching plugin module by computed path
- **Verify:** the configured plugin is loaded and its `run()` export is invoked
- **Done when:** the loader dispatches to the plugin named in config
